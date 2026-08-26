import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { azureRespond, normalizeEndpoint, type AzureConfig } from "@/lib/azure-llm";

describe("normalizeEndpoint", () => {
  it("eksik yolu tamamlar", () => {
    expect(normalizeEndpoint("https://x.services.ai.azure.com")).toBe(
      "https://x.services.ai.azure.com/openai/v1",
    );
    expect(normalizeEndpoint("https://x.services.ai.azure.com/openai")).toBe(
      "https://x.services.ai.azure.com/openai/v1",
    );
  });

  it("doğru yazılmış adrese dokunmaz, sondaki eğik çizgiyi atar", () => {
    expect(normalizeEndpoint("https://x.services.ai.azure.com/openai/v1/")).toBe(
      "https://x.services.ai.azure.com/openai/v1",
    );
    expect(normalizeEndpoint("  https://x.services.ai.azure.com/openai/v1  ")).toBe(
      "https://x.services.ai.azure.com/openai/v1",
    );
  });
});

/**
 * Tel üzerinde ne gittiğini sabitler: sağlayıcı değiştirirken en kolay kaçan
 * şey başlığın ya da alanın adı, ve bunu ancak üretimde 401/400 olarak
 * görüyorsun. Sahte sunucu gerçek bir ağ çağrısı değil — yerel soket.
 */
describe("azureRespond", () => {
  let sunucu: http.Server;
  let config: AzureConfig;
  let gelen: { url?: string; headers: http.IncomingHttpHeaders; body: unknown };
  let yanit: { status: number; payload: unknown } = { status: 200, payload: {} };

  beforeAll(async () => {
    sunucu = http.createServer((req, res) => {
      let ham = "";
      req.on("data", (parca) => (ham += parca));
      req.on("end", () => {
        gelen = { url: req.url, headers: req.headers, body: JSON.parse(ham || "{}") };
        res.writeHead(yanit.status, { "content-type": "application/json" });
        res.end(JSON.stringify(yanit.payload));
      });
    });
    await new Promise<void>((resolve) => sunucu.listen(0, "127.0.0.1", resolve));

    const { port } = sunucu.address() as AddressInfo;
    config = {
      endpoint: `http://127.0.0.1:${port}/openai/v1`,
      deployment: "gpt-test",
      auth: { kind: "key", key: "gizli" },
    };
  });

  afterAll(() => sunucu.close());

  it("dağıtımı /responses ucuna api-key başlığıyla gönderir", async () => {
    yanit = {
      status: 200,
      payload: {
        status: "completed",
        output: [{ type: "message", content: [{ type: "output_text", text: "Ankara" }] }],
      },
    };

    const sonuc = await azureRespond({ prompt: "Başkent?" }, config);

    expect(sonuc.ok).toBe(true);
    expect(gelen.url).toBe("/openai/v1/responses");
    expect(gelen.headers["api-key"]).toBe("gizli");
    expect(gelen.headers.authorization).toBeUndefined();
    expect((gelen.body as { model: string }).model).toBe("gpt-test");
  });

  it("jeton kimliğinde Bearer başlığı kullanır", async () => {
    await azureRespond(
      { prompt: "x" },
      { ...config, auth: { kind: "token", token: "abc" } },
    );

    expect(gelen.headers.authorization).toBe("Bearer abc");
    expect(gelen.headers["api-key"]).toBeUndefined();
  });

  it("HTTP hatasını Türkçe mesaja çevirir", async () => {
    yanit = { status: 404, payload: { error: { message: "DeploymentNotFound" } } };

    const sonuc = await azureRespond({ prompt: "x" }, config);

    expect(sonuc.ok).toBe(false);
    if (!sonuc.ok) {
      expect(sonuc.status).toBe(404);
      expect(sonuc.message).toMatch(/dağıtım/i);
    }
  });

  it("yapılandırma yoksa sebebi söyler, çağrı yapmaz", async () => {
    const sonuc = await azureRespond({ prompt: "x" }, null);

    expect(sonuc.ok).toBe(false);
    if (!sonuc.ok) expect(sonuc.message).toMatch(/AZURE_AI_ENDPOINT/);
  });
});
