/**
 * OpenAI "Responses" API'sinin gövde ve yanıt biçimi — saf, ağ yok.
 *
 * Azure AI Foundry'nin `/openai/v1` ucu bu sözleşmeyi konuşuyor. Gövdeyi kuran
 * ve yanıtı okuyan mantık burada durunca test edilebiliyor: bir alanın yanlış
 * yere yazılması, çıktıyı yalnız üretimde fark ettiğimiz bir hata olmasın.
 *
 * Anthropic yolundaki iki kural burada da geçerli:
 * - Belge/görsel bloğu metin bloğundan ÖNCE gelir (TUZAKLAR #33).
 * - Şema *şekli* garanti eder, *doğruluğu* değil; dönen veri yine kendi zod
 *   şemamızdan geçer (CLAUDE.md: faturadan çıkan veri kullanıcıya onaylatılır).
 */

export type ResponsesFile =
  | { kind: "pdf"; base64: string; filename?: string }
  | { kind: "image"; mediaType: string; base64: string };

export type ResponsesRequest = {
  model: string;
  /** Sistem yönergesi. Responses API'de `instructions` alanı. */
  system?: string;
  prompt: string;
  file?: ResponsesFile;
  /** Yapılandırılmış çıktı; verilirse model şemaya uymak zorunda. */
  schema?: { name: string; schema: unknown };
  maxOutputTokens?: number;
  /** Akıl yürüten dağıtımlarda gecikmeyi düşürür. Desteklemeyen model 400 döner. */
  reasoningEffort?: "low" | "medium" | "high";
};

type ContentBlock = Record<string, unknown>;

/** Dosyayı `data:` URL'ine çevirir; Responses API base64'ü böyle bekliyor. */
function dataUrl(mediaType: string, base64: string): string {
  return `data:${mediaType};base64,${base64}`;
}

function fileBlock(file: ResponsesFile): ContentBlock {
  if (file.kind === "pdf") {
    return {
      type: "input_file",
      filename: file.filename ?? "belge.pdf",
      file_data: dataUrl("application/pdf", file.base64),
    };
  }
  return {
    type: "input_image",
    image_url: dataUrl(file.mediaType, file.base64),
    detail: "auto",
  };
}

export function buildResponsesRequest(
  request: ResponsesRequest,
): Record<string, unknown> {
  const content: ContentBlock[] = [];
  if (request.file) content.push(fileBlock(request.file));
  content.push({ type: "input_text", text: request.prompt });

  const body: Record<string, unknown> = {
    model: request.model,
    input: [{ role: "user", content }],
  };

  if (request.system) body.instructions = request.system;
  if (request.maxOutputTokens) body.max_output_tokens = request.maxOutputTokens;
  if (request.reasoningEffort) {
    body.reasoning = { effort: request.reasoningEffort };
  }
  if (request.schema) {
    body.text = {
      format: {
        type: "json_schema",
        name: request.schema.name,
        strict: true,
        schema: request.schema.schema,
      },
    };
  }

  return body;
}

export type ResponsesRead =
  | { ok: true; text: string }
  | { ok: false; message: string };

type OutputItem = {
  type?: string;
  content?: Array<{ type?: string; text?: string; refusal?: string }>;
};

type ResponsePayload = {
  status?: string;
  incomplete_details?: { reason?: string };
  output_text?: string;
  output?: OutputItem[];
  usage?: { input_tokens?: number; output_tokens?: number };
};

/**
 * Yanıttaki metni çıkarır.
 *
 * `output` dizisinin ilk elemanı metin olmak zorunda değil: akıl yürüten
 * modellerde önce `reasoning` bloğu gelir. İlk elemanı okumak (Python
 * örneğindeki `output[0]` gibi) bu yüzden boş dönebiliyor — mesaj bloklarını
 * arayıp topluyoruz.
 */
export function readOutputText(payload: unknown): ResponsesRead {
  const data = (payload ?? {}) as ResponsePayload;

  const refusal = (data.output ?? [])
    .flatMap((item) => item.content ?? [])
    .find((block) => block.type === "refusal");
  if (refusal) {
    return { ok: false, message: "Model bu belgeyi işlemeyi reddetti" };
  }

  const parts = (data.output ?? [])
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((block) => block.type === "output_text")
    .map((block) => block.text ?? "");

  const text = (parts.length > 0 ? parts.join("") : (data.output_text ?? "")).trim();

  if (!text) {
    // Akıl yürütme bütçeyi yiyip metne sıra gelmemiş olabilir; sebebi söyle.
    if (data.incomplete_details?.reason === "max_output_tokens") {
      return {
        ok: false,
        message: "Yanıt uzunluk sınırına takıldı; max_output_tokens artırılmalı",
      };
    }
    if (data.status && data.status !== "completed") {
      return { ok: false, message: `Yanıt tamamlanmadı (${data.status})` };
    }
    return { ok: false, message: "Modelden boş yanıt geldi" };
  }

  return { ok: true, text };
}

export function readUsage(payload: unknown): {
  inputTokens: number;
  outputTokens: number;
} {
  const usage = ((payload ?? {}) as ResponsePayload).usage ?? {};
  return {
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
  };
}

/**
 * HTTP hatasını Türkçeye çevirir. Azure'un dönüş gövdesi çoğu zaman
 * `{ error: { code, message } }`; kod olmadan sebebi tahmin etmek zor.
 */
export function azureErrorText(status: number, payload: unknown): string {
  const error = ((payload ?? {}) as { error?: { code?: string; message?: string } })
    .error;
  const detail = error?.message?.trim();

  if (status === 401 || status === 403) {
    return (
      "Kimlik doğrulanamadı. Anahtar kullanıyorsan AZURE_AI_API_KEY doğru mu; " +
      "Entra ID kullanıyorsan uygulama kaydına kaynak üzerinde " +
      "'Cognitive Services OpenAI User' rolü verilmiş mi?"
    );
  }
  if (status === 404) {
    return (
      "Uç ya da dağıtım bulunamadı. AZURE_AI_ENDPOINT '/openai/v1' ile bitmeli " +
      "ve AZURE_AI_DEPLOYMENT dağıtımın adı olmalı (model adı değil)."
    );
  }
  if (status === 429) {
    return "Şu an yoğunluk var, birazdan tekrar dene";
  }
  if (status === 400 && detail && /json_schema|response_format|text\.format/i.test(detail)) {
    return `Dağıtım yapılandırılmış çıktıyı kabul etmedi: ${detail}`;
  }
  if (detail) return `Model çağrısı başarısız (${status}): ${detail}`;
  return `Model çağrısı başarısız (${status})`;
}
