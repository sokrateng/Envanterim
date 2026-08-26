import { describe, expect, it } from "vitest";
import {
  azureErrorText,
  buildResponsesRequest,
  readOutputText,
  readUsage,
} from "@/lib/openai-responses";

const SCHEMA = { type: "object", properties: {} };

describe("buildResponsesRequest", () => {
  it("dosya bloğunu metinden önce koyar", () => {
    const body = buildResponsesRequest({
      model: "gpt-5.6-sol",
      prompt: "Oku",
      file: { kind: "image", mediaType: "image/jpeg", base64: "AAA" },
    });

    const input = body.input as Array<{ content: Array<{ type: string }> }>;
    expect(input[0].content.map((block) => block.type)).toEqual([
      "input_image",
      "input_text",
    ]);
  });

  it("PDF'i input_file olarak data URL'iyle gönderir", () => {
    const body = buildResponsesRequest({
      model: "m",
      prompt: "Oku",
      file: { kind: "pdf", base64: "QkI=", filename: "fatura.pdf" },
    });

    const input = body.input as Array<{ content: Array<Record<string, string>> }>;
    expect(input[0].content[0]).toMatchObject({
      type: "input_file",
      filename: "fatura.pdf",
      file_data: "data:application/pdf;base64,QkI=",
    });
  });

  it("dosyasız çağrıda yalnız metin bloğu olur", () => {
    const body = buildResponsesRequest({ model: "m", prompt: "Merhaba" });
    const input = body.input as Array<{ content: Array<{ type: string }> }>;
    expect(input[0].content).toHaveLength(1);
    expect(input[0].content[0].type).toBe("input_text");
  });

  it("şema verilince katı yapılandırılmış çıktı ister", () => {
    const body = buildResponsesRequest({
      model: "m",
      prompt: "Oku",
      schema: { name: "fatura", schema: SCHEMA },
    });

    expect(body.text).toEqual({
      format: { type: "json_schema", name: "fatura", strict: true, schema: SCHEMA },
    });
  });

  it("isteğe bağlı alanları yalnız verilince ekler", () => {
    const yalin = buildResponsesRequest({ model: "m", prompt: "x" });
    expect(yalin).not.toHaveProperty("text");
    expect(yalin).not.toHaveProperty("reasoning");
    expect(yalin).not.toHaveProperty("instructions");
    expect(yalin).not.toHaveProperty("max_output_tokens");

    const dolu = buildResponsesRequest({
      model: "m",
      prompt: "x",
      system: "Sistem",
      maxOutputTokens: 1200,
      reasoningEffort: "low",
    });
    expect(dolu.instructions).toBe("Sistem");
    expect(dolu.max_output_tokens).toBe(1200);
    expect(dolu.reasoning).toEqual({ effort: "low" });
  });
});

describe("readOutputText", () => {
  it("akıl yürütme bloğunu atlayıp mesaj metnini bulur", () => {
    const okundu = readOutputText({
      status: "completed",
      output: [
        { type: "reasoning", content: [] },
        { type: "message", content: [{ type: "output_text", text: '{"a":1}' }] },
      ],
    });

    expect(okundu).toEqual({ ok: true, text: '{"a":1}' });
  });

  it("parçalı metni birleştirir", () => {
    const okundu = readOutputText({
      output: [
        {
          type: "message",
          content: [
            { type: "output_text", text: "ilk" },
            { type: "output_text", text: "-son" },
          ],
        },
      ],
    });

    expect(okundu).toEqual({ ok: true, text: "ilk-son" });
  });

  it("reddi hata sayar", () => {
    const okundu = readOutputText({
      output: [{ type: "message", content: [{ type: "refusal", refusal: "olmaz" }] }],
    });

    expect(okundu.ok).toBe(false);
  });

  it("uzunluk sınırına takılan yanıtın sebebini söyler", () => {
    const okundu = readOutputText({
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
      output: [{ type: "reasoning", content: [] }],
    });

    expect(okundu).toEqual({
      ok: false,
      message: "Yanıt uzunluk sınırına takıldı; max_output_tokens artırılmalı",
    });
  });

  it("boş yanıtı hata sayar", () => {
    expect(readOutputText({ status: "completed", output: [] }).ok).toBe(false);
    expect(readOutputText(null).ok).toBe(false);
  });
});

describe("readUsage", () => {
  it("eksik kullanım bilgisini sıfırlar", () => {
    expect(readUsage({})).toEqual({ inputTokens: 0, outputTokens: 0 });
    expect(readUsage({ usage: { input_tokens: 12, output_tokens: 3 } })).toEqual({
      inputTokens: 12,
      outputTokens: 3,
    });
  });
});

describe("azureErrorText", () => {
  it("401'de kimlik, 404'te dağıtım adını işaret eder", () => {
    expect(azureErrorText(401, {})).toMatch(/Kimlik doğrulanamadı/);
    expect(azureErrorText(404, {})).toMatch(/dağıtım/i);
  });

  it("429'u yoğunluk olarak çevirir", () => {
    expect(azureErrorText(429, {})).toMatch(/yoğunluk/);
  });

  it("şema hatasında sunucunun mesajını taşır", () => {
    const metin = azureErrorText(400, {
      error: { message: "Invalid schema for response_format 'fatura'." },
    });
    expect(metin).toMatch(/response_format/);
  });

  it("bilinmeyen hatada durum kodunu verir", () => {
    expect(azureErrorText(500, {})).toBe("Model çağrısı başarısız (500)");
  });
});
