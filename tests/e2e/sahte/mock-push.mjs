import https from "node:https";
import fs from "node:fs";
const LOG = "/tmp/mock-push.log";
fs.writeFileSync(LOG, "");
https
  .createServer(
    { key: fs.readFileSync("/tmp/push-key.pem"), cert: fs.readFileSync("/tmp/push-cert.pem") },
    (req, res) => {
    let uzunluk = 0;
    req.on("data", (c) => (uzunluk += c.length));
    req.on("end", () => {
      fs.appendFileSync(LOG, JSON.stringify({ url: req.url, bayt: uzunluk, ttl: req.headers.ttl }) + "\n");
      // /gone uçları ölü abonelik gibi davranır (TUZAKLAR #29)
      if (req.url.startsWith("/gone")) {
        res.writeHead(410).end("Gone");
        return;
      }
      res.writeHead(201).end("");
    });
    },
  )
  .listen(5001, () => console.log("sahte push servisi: https://127.0.0.1:5001"));
