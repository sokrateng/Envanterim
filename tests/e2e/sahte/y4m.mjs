/**
 * Sahte kamera görüntüsü üretir: Chromium'un `--use-file-for-fake-video-capture`
 * bayrağı yalnız .y4m ve .mjpeg okuyor, ortamdaki ffmpeg ise PNG çözemiyor —
 * o yüzden kareyi doğrudan biz yazıyoruz (TUZAKLAR #44).
 *
 *   node tests/e2e/sahte/y4m.mjs qr "<metin>" cikti.y4m
 *   node tests/e2e/sahte/y4m.mjs ean13 8690637123450 cikti.y4m
 */
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const [, , tur, metin, cikti, kareSayisi = "20"] = process.argv;
const W = 640;
const H = 480;

/** Siyah-beyaz bir bit haritasını 640×480 y4m'ye ortalayarak yazar. */
function yaz(bitmap, bw, bh, oran = 0.75) {
  const olcek = Math.max(
    1,
    Math.min(Math.floor((W * oran) / bw), Math.floor((H * oran) / bh)),
  );
  const x0 = Math.round((W - bw * olcek) / 2);
  const y0 = Math.round((H - bh * olcek) / 2);

  const Y = new Uint8Array(W * H).fill(255);
  for (let y = 0; y < bh * olcek; y += 1) {
    for (let x = 0; x < bw * olcek; x += 1) {
      const koyu = bitmap(Math.floor(x / olcek), Math.floor(y / olcek));
      Y[(y0 + y) * W + x0 + x] = koyu ? 16 : 255;
    }
  }

  const U = new Uint8Array((W / 2) * (H / 2)).fill(128);
  const parcalar = [Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420\n`)];
  for (let i = 0; i < Number(kareSayisi); i += 1) {
    parcalar.push(Buffer.from("FRAME\n"), Buffer.from(Y), Buffer.from(U), Buffer.from(U));
  }
  fs.writeFileSync(cikti, Buffer.concat(parcalar));
}

if (tur === "qr") {
  const QRCode = require("qrcode");
  const qr = QRCode.create(metin, { errorCorrectionLevel: "M" });
  const boyut = qr.modules.size;
  yaz((x, y) => qr.modules.data[y * boyut + x], boyut, boyut);
  console.log("qr y4m:", cikti, `${boyut} modül`);
} else {
  const { prepareZXingModule, writeBarcode } = await import("zxing-wasm/writer");
  const wasm = fs.readFileSync(require.resolve("zxing-wasm/writer/zxing_writer.wasm"));
  prepareZXingModule({
    overrides: {
      instantiateWasm: (imports, cb) => {
        WebAssembly.instantiate(wasm, imports).then((r) => cb(r.instance, r.module));
        return {};
      },
    },
  });

  const sonuc = await writeBarcode(metin, { format: "EAN-13", scale: 4 });
  if (sonuc.error) throw new Error(sonuc.error);
  const veri = Object.values(sonuc.symbol.data);
  const bw = sonuc.symbol.width;
  yaz((x, y) => !veri[y * bw + x], bw, sonuc.symbol.height, 0.8);
  console.log("barkod y4m:", cikti, `${bw}×${sonuc.symbol.height}`);
}
