// Küçük bir SMTP alıcısı: gelen postaları /tmp/mock-smtp.log'a yazar.
import net from "node:net";
import fs from "node:fs";

const LOG = "/tmp/mock-smtp.log";
fs.writeFileSync(LOG, "");

net
  .createServer((socket) => {
    let veri = false;
    let govde = "";
    let alicilar = [];

    socket.write("220 sahte-smtp hazır\r\n");
    socket.on("data", (chunk) => {
      const metin = chunk.toString();

      if (veri) {
        govde += metin;
        if (govde.includes("\r\n.\r\n")) {
          veri = false;
          fs.appendFileSync(LOG, JSON.stringify({ alicilar, govde: govde.split("\r\n.\r\n")[0] }) + "\n");
          govde = "";
          alicilar = [];
          socket.write("250 alındı\r\n");
        }
        return;
      }

      for (const satir of metin.split("\r\n").filter(Boolean)) {
        const komut = satir.toUpperCase();
        if (komut.startsWith("EHLO") || komut.startsWith("HELO")) socket.write("250-sahte-smtp\r\n250 OK\r\n");
        else if (komut.startsWith("MAIL FROM")) socket.write("250 OK\r\n");
        else if (komut.startsWith("RCPT TO")) {
          alicilar.push(satir.replace(/.*<|>.*/g, ""));
          socket.write("250 OK\r\n");
        } else if (komut.startsWith("DATA")) {
          veri = true;
          socket.write("354 gövdeyi gönder\r\n");
        } else if (komut.startsWith("QUIT")) {
          socket.write("221 hoşça kal\r\n");
          socket.end();
        } else socket.write("250 OK\r\n");
      }
    });
    socket.on("error", () => {});
  })
  .listen(2525, "127.0.0.1", () => console.log("sahte SMTP: 127.0.0.1:2525"));
