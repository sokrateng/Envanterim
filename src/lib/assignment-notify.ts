import "server-only";

import { assignmentAnswerMail, assignmentMail } from "@/lib/email-message";
import { sendMail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { sendToUsers } from "@/lib/push";

/**
 * Zimmet bildirimleri. Atama karşı taraf için bir istek: haberi olmadan
 * ekipman kimsenin üzerine yazılmıyor.
 *
 * Gönderim `await` ediliyor (TUZAKLAR #1) ve hata akışı durdurmuyor: posta
 * gitmese de zimmet kaydı geçerli, kişi uygulamada görüyor.
 */

type ItemRef = { id: string; name: string };

async function mailTarget(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerifiedAt: true, emailReminders: true },
  });
  // Doğrulanmamış adrese envanter bilgisi gitmiyor (hesap ekranındaki kural).
  if (!user?.email || !user.emailVerifiedAt || !user.emailReminders) return null;
  return user.email;
}

/** Zimmetlenen kişiye: "onayını bekliyoruz". */
export async function notifyAssigned(
  item: ItemRef,
  holderUserId: string,
  assignedByName: string,
): Promise<void> {
  await sendToUsers([holderUserId], {
    title: "Zimmet",
    body: `${assignedByName}, ${item.name} ekipmanını sana zimmetledi`,
    url: `/envanter/${item.id}`,
    tag: `zimmet-${item.id}`,
  });

  const address = await mailTarget(holderUserId);
  if (address) {
    await sendMail(
      address,
      assignmentMail(item, assignedByName, process.env.NEXTAUTH_URL),
    );
  }
}

/** Atayana: kabul edildi ya da geri çevrildi. */
export async function notifyAnswer(
  item: ItemRef,
  assignedById: string,
  holderName: string,
  accepted: boolean,
): Promise<void> {
  await sendToUsers([assignedById], {
    title: accepted ? "Zimmet kabul edildi" : "Zimmet geri çevrildi",
    body: `${holderName} · ${item.name}`,
    url: `/envanter/${item.id}`,
    tag: `zimmet-cevap-${item.id}`,
  });

  const address = await mailTarget(assignedById);
  if (address) {
    await sendMail(
      address,
      assignmentAnswerMail(item, holderName, accepted, process.env.NEXTAUTH_URL),
    );
  }
}
