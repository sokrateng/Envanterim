import {
  azureErrorText,
  buildResponsesRequest,
  type ResponsesRequest,
} from "@/lib/openai-responses";

/**
 * Azure AI Foundry üzerindeki OpenAI uyumlu dağıtıma çağrı.
 *
 * SDK yok, düz `fetch` var: uç zaten OpenAI sözleşmesini konuşuyor ve
 * `@azure/identity` + `openai` paketleri sunucusuz pakete birkaç megabayt
 * ekliyor. Jeton da tek bir HTTP çağrısı — taşımaya değmiyor.
 *
 * `server-only` işareti bilerek yok: `npm run llm:test` bu modülü Next dışında
 * çalıştırıyor, işaret o kullanımı kırıyor. Sırrın istemciye sızmaması işaretle
 * değil, adlandırmayla güvence altında — hiçbiri `NEXT_PUBLIC_` değil, dolayısıyla
 * tarayıcı paketine girmiyor. Faturadan okumanın kendisi (`invoice-extract.ts`)
 * `server-only` işaretli.
 */

export type AzureAuth =
  | { kind: "key"; key: string }
  | {
      kind: "entra";
      tenantId: string;
      clientId: string;
      clientSecret: string;
      scope: string;
    }
  /** Dışarıdan verilen jeton — `az account get-access-token` ile yerel deneme. */
  | { kind: "token"; token: string };

export type AzureConfig = {
  endpoint: string;
  deployment: string;
  auth: AzureAuth;
};

const DEFAULT_SCOPE = "https://ai.azure.com/.default";

/** Uç adresi `/openai/v1` ile bitmeli; eksikse tamamla, fazlaysa kırpma. */
export function normalizeEndpoint(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (/\/openai\/v1$/.test(trimmed)) return trimmed;
  if (/\/openai$/.test(trimmed)) return `${trimmed}/v1`;
  return `${trimmed}/openai/v1`;
}

export function azureAuthFromEnv(): AzureAuth | null {
  const key = process.env.AZURE_AI_API_KEY;
  if (key) return { kind: "key", key };

  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  if (tenantId && clientId && clientSecret) {
    return {
      kind: "entra",
      tenantId,
      clientId,
      clientSecret,
      scope: process.env.AZURE_AI_SCOPE ?? DEFAULT_SCOPE,
    };
  }

  return null;
}

export function azureConfig(auth: AzureAuth | null = azureAuthFromEnv()): AzureConfig | null {
  const endpoint = process.env.AZURE_AI_ENDPOINT;
  const deployment = process.env.AZURE_AI_DEPLOYMENT;
  if (!endpoint || !deployment || !auth) return null;
  return { endpoint: normalizeEndpoint(endpoint), deployment, auth };
}

export function isAzureConfigured(): boolean {
  return azureConfig() !== null;
}

/**
 * İstemci kimlik bilgisi akışıyla jeton. Jeton bir saat geçerli; her çağrıda
 * yenilemek gecikme ve kota israfı, o yüzden bitimine bir dakika kalana kadar
 * saklanıyor.
 */
let cachedToken: { value: string; expiresAt: number } | null = null;

async function entraToken(auth: Extract<AzureAuth, { kind: "entra" }>): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) return cachedToken.value;

  const response = await fetch(
    `https://login.microsoftonline.com/${auth.tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: auth.clientId,
        client_secret: auth.clientSecret,
        scope: auth.scope,
      }),
    },
  );

  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(
      payload.error_description?.split("\n")[0] ??
        `Entra ID jetonu alınamadı (${response.status})`,
    );
  }

  cachedToken = {
    value: payload.access_token,
    expiresAt: now + ((payload.expires_in ?? 3600) - 60) * 1000,
  };
  return cachedToken.value;
}

async function authHeaders(auth: AzureAuth): Promise<Record<string, string>> {
  if (auth.kind === "key") return { "api-key": auth.key };
  if (auth.kind === "token") return { authorization: `Bearer ${auth.token}` };
  return { authorization: `Bearer ${await entraToken(auth)}` };
}

export type AzureResult =
  | { ok: true; payload: unknown }
  | { ok: false; message: string; status?: number };

/**
 * `fetch` çöktüğünde mesaj yalnız "fetch failed" oluyor; sebep `cause` içinde
 * duruyor ve asıl bilgi orada (adres yanlış mı, sunucu kapalı mı).
 */
function fetchHatasi(error: unknown): string {
  if ((error as Error)?.name === "TimeoutError") {
    return "Model yanıt vermedi (zaman aşımı)";
  }
  const sebep = (error as { cause?: { code?: string; message?: string } })?.cause;
  const kod = sebep?.code;
  if (kod === "ENOTFOUND" || kod === "EAI_AGAIN") {
    return "Uç adresi çözülemedi; AZURE_AI_ENDPOINT doğru mu?";
  }
  if (kod === "ECONNREFUSED") return "Uca bağlanılamadı (bağlantı reddedildi)";
  const detay = sebep?.message ?? (error as Error)?.message;
  return detay ? `Model çağrısı başarısız: ${detay}` : "Model çağrısı başarısız";
}

/**
 * Tek bir Responses çağrısı. Model adı dağıtım adı: Azure'da istediğin modeli
 * değil, kaynağa açtığın dağıtımı çağırıyorsun.
 */
export async function azureRespond(
  request: Omit<ResponsesRequest, "model">,
  config: AzureConfig | null = azureConfig(),
): Promise<AzureResult> {
  if (!config) {
    return {
      ok: false,
      message:
        "Azure modeli tanımlı değil: AZURE_AI_ENDPOINT, AZURE_AI_DEPLOYMENT ve " +
        "bir kimlik yöntemi (AZURE_AI_API_KEY ya da AZURE_TENANT_ID/CLIENT_ID/CLIENT_SECRET) gerekli",
    };
  }

  const body = buildResponsesRequest({ ...request, model: config.deployment });

  let response: Response;
  try {
    response = await fetch(`${config.endpoint}/responses`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(await authHeaders(config.auth)),
      },
      body: JSON.stringify(body),
      // Sunucusuz fonksiyonun süresi dolmadan bizim elimizde bitsin ki
      // kullanıcı "Beklenmeyen hata" yerine sebebi görsün.
      signal: AbortSignal.timeout(50_000),
    });
  } catch (error) {
    return { ok: false, message: fetchHatasi(error) };
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: azureErrorText(response.status, payload),
    };
  }

  return { ok: true, payload };
}
