// Sahte abonelikler ve garantisi 30 gün sonra biten bir ekipman hazırlar.
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const prisma = new PrismaClient();
const b64url = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function aboneAnahtarlari() {
  const { publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const raw = publicKey.export({ type: "spki", format: "der" }).subarray(-65);
  return { p256dh: b64url(raw), auth: b64url(crypto.randomBytes(16)) };
}

const kullanici = await prisma.user.findUnique({ where: { username: process.env.E2E_USER ?? "enginc" } });
const uyelik = await prisma.locationMember.findFirst({ where: { userId: kullanici.id, role: "OWNER" } });

await prisma.pushSubscription.deleteMany({ where: { userId: kullanici.id } });
for (const [ad, yol] of [["saglam", "/ok/abc"], ["olu", "/gone/xyz"]]) {
  await prisma.pushSubscription.create({
    data: { userId: kullanici.id, endpoint: `http://127.0.0.1:5001${yol}`, ...aboneAnahtarlari() },
  });
  console.log("· abonelik:", ad);
}

const bitis = new Date();
bitis.setDate(bitis.getDate() + 30);
bitis.setHours(0, 0, 0, 0);
await prisma.itemReminder.deleteMany({ where: { kind: "WARRANTY" } });
const urun = await prisma.item.create({
  data: { locationId: uyelik.locationId, name: "Garanti uyarısı testi", warrantyEndDate: bitis, status: "IN_USE" },
  select: { id: true, name: true },
});
console.log("· ekipman:", urun.name, "| garanti bitişi:", bitis.toISOString().slice(0, 10));

// Emekli ekipman uyarı almamalı
await prisma.item.create({
  data: { locationId: uyelik.locationId, name: "Emekli ürün", warrantyEndDate: bitis, status: "RETIRED" },
});
console.log("· emekli ekipman da eklendi (uyarı almamalı)");
await prisma.$disconnect();
