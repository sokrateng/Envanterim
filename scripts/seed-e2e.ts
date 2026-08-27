/**
 * Uçtan uca testlerin beklediği en küçük veri: bir kullanıcı, bir lokasyon ve
 * bir ekipman. Testlerin çoğu kendi kaydını kendi açıyor; bunlar hepsinin
 * ortak zemini.
 *
 * Var olanı bozmuyor: aynı kullanıcı/lokasyon varsa dokunmadan geçiyor, bu
 * yüzden defalarca çalıştırılabilir.
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const KULLANICI = process.env.E2E_USER ?? "enginc";
const SIFRE = process.env.E2E_PASSWORD ?? "cok-uzun-sifre";
const LOKASYON = "Ev";
const SERI = "SN-4471-A";

/** Testlerin adıyla çağırdığı hesaplar; hepsi aynı şifreyle. */
async function hesap(username: string, name: string) {
  return prisma.user.upsert({
    where: { username },
    update: {},
    create: {
      username,
      name,
      passwordHash: await bcrypt.hash(SIFRE, 10),
      status: "ACTIVE",
    },
    select: { id: true },
  });
}

async function main() {
  const user = await hesap(KULLANICI, "Engin C");
  // İkinci üye (davetle lokasyona ekleniyor) ve envantere hiç üye olmayan
  // "yabancı": yetki testlerinin ikisine de ihtiyacı var.
  const ikinci = await hesap("buketc", "Buket C");
  await hesap("aysek", "Ayşe K");

  const mevcut = await prisma.locationMember.findFirst({
    where: { userId: user.id, role: "OWNER", location: { name: LOKASYON } },
    select: { locationId: true },
  });

  const locationId =
    mevcut?.locationId ??
    (
      await prisma.location.create({
        data: {
          name: LOKASYON,
          icon: "🏠",
          members: { create: { userId: user.id, role: "OWNER" } },
        },
        select: { id: true },
      })
    ).id;

  // İkinci üye tohumda: zimmet ve olay ekranları "kime" sorusunu soruyor,
  // tek üyeli lokasyonda o liste boş kalıyor.
  await prisma.locationMember.upsert({
    where: { locationId_userId: { locationId, userId: ikinci.id } },
    update: {},
    create: { locationId, userId: ikinci.id, role: "EDITOR" },
  });

  const item = await prisma.item.findFirst({
    where: { locationId, serialNo: SERI },
    select: { id: true },
  });

  if (!item) {
    // Garanti bitişi ileri bir tarih: rozet ve hatırlatma ekranları boş kalmasın.
    const garanti = new Date();
    garanti.setMonth(garanti.getMonth() + 8);

    await prisma.item.create({
      data: {
        locationId,
        name: "Çamaşır makinesi",
        brand: "Arçelik",
        model: "9123",
        serialNo: SERI,
        purchasePriceMinor: 2_499_990,
        purchaseDate: new Date(),
        warrantyEndDate: garanti,
      },
    });
  }

  console.log(`hazır: ${KULLANICI} / ${LOKASYON} (${locationId})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
