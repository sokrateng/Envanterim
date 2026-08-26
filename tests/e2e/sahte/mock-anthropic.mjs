import http from "node:http";
import fs from "node:fs";

const LOG = "/tmp/mock-anthropic.log";
fs.writeFileSync(LOG, "");

const cevap = {
  sellerName: "Teknosa Mağazacılık A.Ş.",
  invoiceDate: "2026-01-31",
  currency: "TRY",
  note: null,
  items: [
    {
      name: "Çamaşır makinesi",
      brand: "Bosch",
      model: "WGG24400TR",
      serialNo: "FD9901123456",
      unitPrice: 18400.5,
      warrantyMonths: 24,
    },
    {
      name: "Kurutma makinesi",
      brand: "Bosch",
      model: "WTX87KH0TR",
      serialNo: null,
      unitPrice: 21999,
      warrantyMonths: null,
    },
  ],
};

http
  .createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      fs.appendFileSync(LOG, JSON.stringify({ url: req.url, body: JSON.parse(body || "{}") }) + "\n");
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          id: "msg_test",
          type: "message",
          role: "assistant",
          model: "claude-opus-5",
          content: [{ type: "text", text: JSON.stringify(cevap) }],
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 2500, output_tokens: 400 },
        }),
      );
    });
  })
  .listen(4999, () => console.log("sahte Anthropic sunucusu: http://127.0.0.1:4999"));
