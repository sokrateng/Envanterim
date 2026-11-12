import { NextResponse } from "next/server";
import { z } from "zod";
import { UNAUTHENTICATED, apiError, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { readScan } from "@/lib/scan";
import { currentUser } from "@/lib/session";
import { sameText } from "@/lib/text-match";

const schema = z.object({ kod: z.string().max(4096, "Kod çok uzun") });

/**
 * Okutulan kodun nereye götürdüğüne sunucu karar verir: kod bir kimlik
 * taşıyor olabilir ama o ürünün görülüp görülemeyeceği lokasyon üyeliğinden
 * geçer (CLAUDE.md). Kamera ne görürse görsün istemci yetki uydurmuyor.
 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return UNAUTHENTICATED();

  const parsed = await parseBody(request, schema);
  if ("response" in parsed) return parsed.response;

  const target = readScan(parsed.data.kod);
  if (!target) return apiError("Kod okunamadı", 422);

  if (target.kind === "share") {
    // Bağlantının geçerliliğine sayfanın kendisi bakıyor; burada üyelik aranmaz.
    return NextResponse.json({ tur: "paylasim", token: target.token });
  }

  if (target.kind === "unknown") {
    return NextResponse.json({ tur: "yok", metin: target.text });
  }

  const memberships = await prisma.locationMember.findMany({
    where: { userId: user.id },
    select: { locationId: true },
  });
  const locationIds = memberships.map((m) => m.locationId);
  if (!locationIds.length) return NextResponse.json({ tur: "bulunamadi" });

  if (target.kind === "item") {
    const item = await prisma.item.findFirst({
      where: { id: target.itemId, locationId: { in: locationIds } },
      select: { id: true, name: true, location: { select: { name: true } } },
    });
    // Başkasının etiketiyle "var ama göremezsin" demek bile bilgi sızdırır:
    // olmayan ürünle erişilemeyen ürün aynı yanıtı alır.
    if (!item) return NextResponse.json({ tur: "bulunamadi" });

    return NextResponse.json({
      tur: "urun",
      id: item.id,
      ad: item.name,
      lokasyon: item.location.name,
    });
  }

  // Barkod/seri no: tek bir ürüne denk geliyorsa doğrudan aç, yoksa aramaya
  // düşür — yanlış ürünü açmaktansa listeyi göstermek iyidir.
  // `contains` SQLite'ta ASCII için harf duyarsız (seri numaraları ASCII);
  // tam eşitlik ise uygulamada denetleniyor, "AB1" aramasına "AB12" karışmasın.
  // Sınır (`take`) yok: kısa bir kodda aday sayısı kırpılırsa tam eşleşme
  // düşebilirdi; satırlar üç küçük alan, lokasyon başına zaten az sayıda.
  const query = target.query.trim();
  const candidates = await prisma.item.findMany({
    where: {
      locationId: { in: locationIds },
      serialNo: { contains: query },
    },
    select: {
      id: true,
      name: true,
      serialNo: true,
      location: { select: { name: true } },
    },
  });
  const matches = candidates
    .filter((i) => i.serialNo !== null && sameText(i.serialNo, query))
    .slice(0, 2);

  if (matches.length === 1) {
    return NextResponse.json({
      tur: "urun",
      id: matches[0].id,
      ad: matches[0].name,
      lokasyon: matches[0].location.name,
    });
  }

  // Hiç eşleşme yoksa istemci "ekipman ekle" diye sorabilsin: kodu okutan
  // kullanıcı çoğu zaman elindeki yeni cihazı kaydetmek istiyor.
  return NextResponse.json({
    tur: "arama",
    q: target.query,
    bulunan: matches.length,
  });
}
