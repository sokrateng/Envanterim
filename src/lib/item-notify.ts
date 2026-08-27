import "server-only";

import { newItemMail } from "@/lib/email-message";
import { sendMailToMany } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { sendToUsers } from "@/lib/push";

/**
 * Lokasyona yeni ekipman eklendiğinde üyelere haber.
 *
 * Ekleyen kişiye gitmiyor: kendi yaptığı işin bildirimi gürültü. Gönderim
 * `await` ediliyor (TUZAKLAR #1) ama hiçbir koşulda çağıran işi düşürmüyor —
 * ekipman çoktan açıldı, bildirim yan iş (TUZAKLAR #51).
 */
export async function notifyNewItem(
  item: { id: string; name: string },
  locationId: string,
  addedById: string,
  addedByName: string,
): Promise<void> {
  try {
    const members = await prisma.locationMember.findMany({
      where: { locationId, userId: { not: addedById } },
      select: {
        userId: true,
        user: {
          select: { email: true, emailVerifiedAt: true, emailReminders: true },
        },
      },
    });
    if (members.length === 0) return;

    const location = await prisma.location.findUnique({
      where: { id: locationId },
      select: { name: true },
    });

    await sendToUsers(
      members.map((member) => member.userId),
      {
        title: "Yeni ekipman",
        body: `${addedByName} · ${item.name}`,
        url: `/envanter/${item.id}`,
        tag: `yeni-ekipman-${item.id}`,
      },
    );

    // Doğrulanmamış adrese envanter bilgisi gitmiyor (hesap ekranındaki kural).
    const addresses = members
      .filter(
        (member) =>
          member.user.email &&
          member.user.emailVerifiedAt &&
          member.user.emailReminders,
      )
      .map((member) => member.user.email as string);

    if (addresses.length) {
      await sendMailToMany(
        addresses,
        newItemMail(
          item,
          location?.name ?? "Lokasyon",
          addedByName,
          process.env.NEXTAUTH_URL,
        ),
      );
    }
  } catch (error) {
    console.error("yeni ekipman bildirimi gönderilemedi", (error as Error)?.message);
  }
}
