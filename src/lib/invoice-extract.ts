import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import {
  INVOICE_JSON_SCHEMA,
  extractedInvoiceSchema,
  type ExtractedInvoice,
} from "@/lib/invoice";

/**
 * Faturadan ekipman bilgisi çıkarma — tek Claude çağrısı, ayrı OCR katmanı yok
 * (MIMARI §6). PDF `document`, fotoğraf `image` bloğu olarak gider; yanıt
 * yapılandırılmış çıktı ile şemaya uyar.
 *
 * Çağrı yalnız sunucuda: `ANTHROPIC_API_KEY` asla `NEXT_PUBLIC_` olmaz
 * (CLAUDE.md). Bu modül `server-only` ile işaretli, istemciden içe aktarılırsa
 * derleme kırılır.
 */

const SYSTEM = `Türkiye'de kesilmiş satın alma faturalarından ev ve iş yeri
ekipmanlarının bilgilerini çıkarıyorsun.

Kurallar:
- Yalnız faturada gerçekten yazan bilgiyi ver. Emin olmadığın alanı null bırak;
  tahmin etme, uydurma.
- Seri numarası ile model kodunu karıştırma. Fatura kaleminde ikisi de yoksa
  ikisini de null bırak.
- Tutarlar KDV dahil birim fiyat olsun, ondalık sayı olarak (18400.50).
- Kargo, montaj, indirim, ambalaj gibi ekipman olmayan satırları kalem listesine
  koyma.
- Fatura tarihini YYYY-MM-DD biçiminde ver.
- Garanti süresi faturada ay olarak yazıyorsa warrantyMonths'a yaz, yazmıyorsa
  null bırak — garanti süresi varsayma.`;

const PROMPT = `Bu faturadan ekipman bilgilerini çıkar.`;

export type ExtractSource =
  | { kind: "pdf"; base64: string }
  | { kind: "image"; mediaType: string; base64: string };

export type ExtractResult =
  | { ok: true; data: ExtractedInvoice; inputTokens: number; outputTokens: number }
  | { ok: false; message: string };

/** İstemci çağrı anında kurulur: anahtar yoksa modül yüklenirken patlamasın. */
function createClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return new Anthropic();
}

export function isExtractionConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function extractInvoice(
  source: ExtractSource,
  client: Anthropic | null = createClient(),
): Promise<ExtractResult> {
  if (!client) {
    return {
      ok: false,
      message: "Faturadan okuma kapalı: sunucuda ANTHROPIC_API_KEY tanımlı değil",
    };
  }

  // Belge/görsel bloğu metin bloğundan ÖNCE gelmeli (TUZAKLAR #33).
  const fileBlock: Anthropic.ContentBlockParam =
    source.kind === "pdf"
      ? {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: source.base64,
          },
        }
      : {
          type: "image",
          source: {
            type: "base64",
            media_type: source.mediaType as "image/jpeg" | "image/png" | "image/webp",
            data: source.base64,
          },
        };

  try {
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 16000,
      system: SYSTEM,
      thinking: { type: "adaptive" },
      output_config: {
        // İyi tanımlı bir çıkarma işi; gecikmeyi düşük tutuyoruz (MIMARI §6).
        effort: "low",
        format: jsonSchemaOutputFormat(INVOICE_JSON_SCHEMA),
      },
      messages: [
        { role: "user", content: [fileBlock, { type: "text", text: PROMPT }] },
      ],
    });

    // Güvenlik reddi yanıtı da 200 döner; içeriği okumadan önce bak.
    if (response.stop_reason === "refusal") {
      return { ok: false, message: "Model bu belgeyi işlemeyi reddetti" };
    }

    // Yapılandırılmış çıktı şekli garanti eder ama yine de kendi şemamızdan
    // geçiriyoruz: uygulamanın beklediği tip tek yerden doğrulansın.
    const parsed = extractedInvoiceSchema.safeParse(response.parsed_output);
    if (!parsed.success) {
      return { ok: false, message: "Fatura okunamadı, yanıt şemaya uymadı" };
    }

    return {
      ok: true,
      data: parsed.data,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return { ok: false, message: "Şu an yoğunluk var, birazdan tekrar dene" };
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return { ok: false, message: "API anahtarı geçersiz" };
    }
    if (error instanceof Anthropic.APIError) {
      console.error("fatura okuma hatası", error.status, error.message);
      return { ok: false, message: "Fatura okunamadı" };
    }
    // Yanıt JSON'a çevrilemezse SDK bunu AnthropicError olarak atıyor;
    // 500 yerine anlaşılır bir mesaj dönmeli.
    if (error instanceof Anthropic.AnthropicError) {
      console.error("fatura yanıtı ayrıştırılamadı", error.message);
      return { ok: false, message: "Fatura okunamadı, yanıt şemaya uymadı" };
    }
    throw error;
  }
}
