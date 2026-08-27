import "server-only";

import { itemChangeMail, newItemMail } from "@/lib/email-message";
import { changeSummary } from "@/lib/item-changes";
import { sendMailToMany } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { sendToUsers } from "@/lib/push";

/**
 * Envanter olaylarının lokasyon üyelerine haberi.
 *
 * İki kural her ikisinde de aynı:
 * - **Yapana gitmiyor.** Kendi yaptığı işin bildirimi gürültü.
 * - **Kişisel tercihe bağlı.** Tercih kanaldan bağımsız: kapalıysa ne push ne
 *   e-posta gider. E-posta ayrıca doğrulanmış adres ve açık e-posta anahtarı
 *   istiyor (hesap ekranındaki kural).
 *
 * Gönderim `await` ediliyor (TUZAKLAR #1) ama hiçbir koşulda çağıran işi
 * düşürmüyor: kayıt çoktan yazıldı, bildirim yan iş (TUZAKLAR #51).
 */

type Ref = { id: string; name: string };

type Member = {
  userId: string;
  user: {
    email: string | null;
    emailVerifiedAt: Date | null;
    emailReminders: boolean;
  };
};

/** Doğrulanmış ve e-postayı açık bırakmış adresler. */
function addresses(members: Member[]): string[] {
  return members
    .filter(
      (member) =>
        member.user.email && member.user.emailVerifiedAt && member.user.emailReminders,
    )
    .map((member) => member.user.email as string);
}

async function audience(
  locationId: string,
  exceptUserId: string,
  pref: "notifyNewItem" | "notifyItemChange",
): Promise<{ members: Member[]; locationName: string }> {
  const [members, location] = await Promise.all([
    prisma.locationMember.findMany({
      where: {
        locationId,
        userId: { not: exceptUserId },
        user: { [pref]: true },
      },
      select: {
        userId: true,
        user: {
          select: { email: true, emailVerifiedAt: true, emailReminders: true },
        },
      },
    }),
    prisma.location.findUnique({
      where: { id: locationId },
      select: { name: true },
    }),
  ]);

  return { members, locationName: location?.name ?? "Lokasyon" };
}

/** Lokasyona yeni ekipman eklendi. */
export async function notifyNewItem(
  item: Ref,
  locationId: string,
  addedById: string,
  addedByName: string,
): Promise<void> {
  try {
    const { members, locationName } = await audience(
      locationId,
      addedById,
      "notifyNewItem",
    );
    if (members.length === 0) return;

    await sendToUsers(
      members.map((member) => member.userId),
      {
        title: "Yeni ekipman",
        body: `${addedByName} · ${item.name}`,
        url: `/envanter/${item.id}`,
        tag: `yeni-ekipman-${item.id}`,
      },
    );

    const to = addresses(members);
    if (to.length) {
      await sendMailToMany(
        to,
        newItemMail(item, locationName, addedByName, process.env.NEXTAUTH_URL),
      );
    }
  } catch (error) {
    console.error("yeni ekipman bildirimi gönderilemedi", (error as Error)?.message);
  }
}

/** Ekipman güncellendi. Değişiklik listesi boşsa hiç gönderilmiyor. */
export async function notifyItemChange(
  item: Ref,
  locationId: string,
  changedById: string,
  changedByName: string,
  changes: string[],
): Promise<void> {
  if (changes.length === 0) return;

  try {
    const { members, locationName } = await audience(
      locationId,
      changedById,
      "notifyItemChange",
    );
    if (members.length === 0) return;

    await sendToUsers(
      members.map((member) => member.userId),
      {
        title: `${item.name} güncellendi`,
        body: `${changedByName} · ${changeSummary(changes)}`,
        url: `/envanter/${item.id}`,
        // Aynı ekipmanın art arda düzenlenmesi tek bildirimde toplansın.
        tag: `ekipman-degisti-${item.id}`,
      },
    );

    const to = addresses(members);
    if (to.length) {
      await sendMailToMany(
        to,
        itemChangeMail(
          item,
          locationName,
          changedByName,
          changes,
          process.env.NEXTAUTH_URL,
        ),
      );
    }
  } catch (error) {
    console.error("değişiklik bildirimi gönderilemedi", (error as Error)?.message);
  }
}
