/**
 * Belge okumayı sınamak için bilinen içerikli bir fatura.
 *
 * Kullanıcıdan dosya istemek yerine üretiyoruz: dönen alanları beklediğimizle
 * karşılaştırabiliyoruz. Yalnız `npm run llm:test` kullanıyor, uygulama
 * paketine girmiyor.
 */

/**
 * Türkçe karakter yok: Helvetica'nın varsayılan kodlaması taşımıyor, sınadığımız
 * şey de kodlama değil.
 */
export function ornekFatura(): string {
  const satirlar = [
    "FATURA",
    "Satici: Teknosa Magazacilik A.S.",
    "Tarih: 31.01.2026",
    "Kalem: Bosch WGG24400TR Camasir Makinesi",
    "Seri No: FD9901123456",
    "Garanti: 24 ay",
    "KDV Dahil Birim Fiyat: 18.400,50 TL",
    "Kargo: 250,00 TL",
  ];

  const icerik = satirlar
    .map((satir, index) => {
      const kacan = satir.replace(/([()\\])/g, "\\$1");
      return `BT /F1 12 Tf 50 ${780 - index * 24} Td (${kacan}) Tj ET`;
    })
    .join("\n");

  const nesneler = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
      "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${icerik.length} >>\nstream\n${icerik}\nendstream`,
  ];

  // xref tablosu bayt konumu istiyor; gövdeyi kurarken sayıyoruz.
  let pdf = "%PDF-1.4\n";
  const konumlar: number[] = [];
  nesneler.forEach((govde, index) => {
    konumlar.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${govde}\nendobj\n`;
  });

  const xref = pdf.length;
  pdf += `xref\n0 ${nesneler.length + 1}\n0000000000 65535 f \n`;
  for (const konum of konumlar) {
    pdf += `${String(konum).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${nesneler.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1").toString("base64");
}

