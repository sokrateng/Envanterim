/**
 * Model bağlantısını dağıtmadan önce sınar.
 *
 *   npm run llm:test                 # üç deneme: metin, şema, PDF
 *   npm run llm:test -- fatura.pdf   # üstüne gerçek bir belgeyle dener
 *
 * `.env` içindeki AZURE_AI_* değerlerini kullanır. Amaç, faturadan okumanın
 * üretimde sessizce çalışmadığını fark etmek yerine burada görmek: üç denemenin
 * her biri ayrı bir yeteneği ölçüyor (erişim, yapılandırılmış çıktı, belge
 * okuma) ve hangisinin düştüğü doğrudan hangi ayarın eksik olduğunu söylüyor.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  azureConfig,
  azureRespond,
  type AzureAuth,
  type AzureConfig,
} from "@/lib/azure-llm";
import { readOutputText, readUsage } from "@/lib/openai-responses";
import { INVOICE_JSON_SCHEMA, extractedInvoiceSchema } from "@/lib/invoice";
import { ornekFatura } from "./sample-invoice";

/** `az login` ile giriş yapılmış makinede jeton; yoksa null. */
function azCliToken(): AzureAuth | null {
  const scope = process.env.AZURE_AI_SCOPE ?? "https://ai.azure.com/.default";
  try {
    const raw = execFileSync(
      process.platform === "win32" ? "az.cmd" : "az",
      ["account", "get-access-token", "--scope", scope, "-o", "json"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    const token = (JSON.parse(raw) as { accessToken?: string }).accessToken;
    return token ? { kind: "token", token } : null;
  } catch {
    return null;
  }
}

function resolveConfig(): { config: AzureConfig; nasil: string } | null {
  const fromEnv = azureConfig();
  if (fromEnv) {
    const nasil =
      fromEnv.auth.kind === "key"
        ? "AZURE_AI_API_KEY (anahtar)"
        : "AZURE_TENANT_ID/CLIENT_ID/CLIENT_SECRET (Entra ID uygulama kaydı)";
    return { config: fromEnv, nasil };
  }

  const cli = azCliToken();
  if (cli) {
    const config = azureConfig(cli);
    if (config) return { config, nasil: "az CLI oturumu (yalnız bu makinede)" };
  }

  return null;
}

/** Tek deneme: başlığı yaz, çağır, sonucu bas. Hata programı durdurur. */
async function dene(
  baslik: string,
  config: AzureConfig,
  request: Parameters<typeof azureRespond>[0],
  kontrol: (metin: string) => string,
): Promise<void> {
  process.stdout.write(`\n${baslik}\n`);
  const basladi = Date.now();
  const sonuc = await azureRespond(request, config);
  const saniye = ((Date.now() - basladi) / 1000).toFixed(1);

  if (!sonuc.ok) {
    console.error(`  BAŞARISIZ (${saniye} sn): ${sonuc.message}`);
    process.exit(1);
  }

  const okundu = readOutputText(sonuc.payload);
  if (!okundu.ok) {
    console.error(`  BAŞARISIZ (${saniye} sn): ${okundu.message}`);
    process.exit(1);
  }

  const usage = readUsage(sonuc.payload);
  console.log(`  TAMAM (${saniye} sn · ${usage.inputTokens}+${usage.outputTokens} jeton)`);
  console.log(`  ${kontrol(okundu.text)}`);
}

/** Şemadan dönen JSON'u okunur özete çevirir; şemaya uymuyorsa patlar. */
function faturaOzeti(metin: string): string {
  const parsed = extractedInvoiceSchema.safeParse(JSON.parse(metin));
  if (!parsed.success) {
    console.error("  Yanıt JSON ama beklediğimiz şemaya uymuyor:", metin.slice(0, 400));
    process.exit(1);
  }
  const fatura = parsed.data;
  const kalemler = fatura.items
    .map((kalem) => `${kalem.name} · ${kalem.unitPrice ?? "?"}`)
    .join(" | ");
  return `satici=${fatura.sellerName} tarih=${fatura.invoiceDate} kalem(${fatura.items.length}): ${kalemler}`;
}

const SISTEM = "Faturalardan ekipman bilgisi çıkaran bir yardımcısın. Emin olmadığın alanı null bırak.";
const SEMA = { name: "fatura", schema: INVOICE_JSON_SCHEMA };

async function main() {
  const cozum = resolveConfig();
  if (!cozum) {
    console.error(
      "Azure modeli tanımlı değil. .env dosyasına ekle:\n" +
        '  AZURE_AI_ENDPOINT="https://<kaynak>.services.ai.azure.com/openai/v1"\n' +
        '  AZURE_AI_DEPLOYMENT="gpt-5.6-sol"\n' +
        "ve kimlik için ya\n" +
        '  AZURE_AI_API_KEY="<kaynak anahtarı>"\n' +
        "ya da uygulama kaydı için\n" +
        '  AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET\n' +
        "Yerelde `az login` yaptıysan bu betik onu da kullanabilir.",
    );
    process.exit(1);
  }

  const { config, nasil } = cozum;
  console.log(`Uç:      ${config.endpoint}`);
  console.log(`Dağıtım: ${config.deployment}`);
  console.log(`Kimlik:  ${nasil}`);

  await dene(
    "1) Erişim — düz metin sorusu",
    config,
    { prompt: "Türkiye'nin başkenti neresi? Tek kelimeyle yaz.", maxOutputTokens: 2000 },
    (metin) => `yanıt: ${metin.slice(0, 120)}`,
  );

  await dene(
    "2) Yapılandırılmış çıktı — fatura şeması (metin)",
    config,
    {
      system: SISTEM,
      prompt:
        "Su faturayi cikar: Satici Teknosa Magazacilik A.S., tarih 31.01.2026, " +
        "Bosch WGG24400TR camasir makinesi, seri no FD9901123456, 24 ay garanti, " +
        "KDV dahil 18.400,50 TL. Ayrica 250,00 TL kargo bedeli var.",
      schema: SEMA,
      maxOutputTokens: 16000,
    },
    faturaOzeti,
  );

  await dene(
    "3) Belge okuma — üretilmiş örnek PDF",
    config,
    {
      system: SISTEM,
      prompt: "Bu faturadan ekipman bilgilerini çıkar.",
      file: { kind: "pdf", base64: ornekFatura(), filename: "ornek-fatura.pdf" },
      schema: SEMA,
      maxOutputTokens: 16000,
    },
    faturaOzeti,
  );

  const dosya = process.argv[2];
  if (dosya) {
    const uzanti = path.extname(dosya).toLowerCase();
    const tur: Record<string, string> = {
      ".pdf": "application/pdf",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
    };
    const mime = tur[uzanti];
    if (!mime) {
      console.error(`\nDesteklenmeyen dosya türü: ${uzanti} (PDF, JPEG, PNG, WEBP)`);
      process.exit(1);
    }

    const base64 = fs.readFileSync(dosya).toString("base64");
    await dene(
      `4) Gerçek belge — ${path.basename(dosya)}`,
      config,
      {
        system: SISTEM,
        prompt: "Bu faturadan ekipman bilgilerini çıkar.",
        file:
          mime === "application/pdf"
            ? { kind: "pdf", base64, filename: path.basename(dosya) }
            : { kind: "image", mediaType: mime, base64 },
        schema: SEMA,
        maxOutputTokens: 16000,
      },
      faturaOzeti,
    );
  } else {
    console.log("\n(Gerçek bir faturayla denemek için: npm run llm:test -- fatura.pdf)");
  }

  console.log("\nHepsi tamam. Faturadan okuma bu dağıtımla çalışır.");
}

main().catch((error) => {
  console.error("Beklenmeyen hata:", (error as Error).message);
  process.exit(1);
});
