import QRCode from "qrcode";
import { itemUrl, labelLines, labelTitle } from "@/lib/qr";

export type LabelItem = {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  serialNo: string | null;
  locationName: string | null;
};

/**
 * Yazdırılabilir QR etiketi. QR sunucuda SVG olarak üretiliyor: istemciye
 * kütüphane inmiyor, yazdırmada çözünürlük sorunu olmuyor.
 */
export async function Label({
  item,
  baseUrl,
  size = 128,
}: {
  item: LabelItem;
  baseUrl: string;
  size?: number;
}) {
  const url = itemUrl(baseUrl, item.id);
  const svg = await QRCode.toString(url, {
    type: "svg",
    margin: 0,
    width: size,
    errorCorrectionLevel: "M",
  });

  return (
    <div className="flex items-center gap-3 rounded-card border border-separator bg-white p-3 text-black">
      {/* Üretilen SVG sabit ve bizim ürettiğimiz bir dizgi. */}
      <div
        className="shrink-0"
        style={{ width: size, height: size }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="min-w-0">
        <p className="text-headline leading-tight">{labelTitle(item.name)}</p>
        {labelLines(item).map((line) => (
          <p key={line.label} className="text-caption leading-snug text-neutral-600">
            <span className="uppercase">{line.label}:</span> {line.value}
          </p>
        ))}
        <p className="pt-1 text-[10px] leading-none text-neutral-400">Envanterim</p>
      </div>
    </div>
  );
}
