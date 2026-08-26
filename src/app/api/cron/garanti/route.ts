import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPushConfigured, sendToUsers } from "@/lib/push";
import {
  planReminders,
  reminderWindow,
  warrantyPushPayload,
} from "@/lib/reminders";

/**
 * Günde bir çalışan garanti uyarısı (MIMARI §4). Vercel Cron tetikler.
 *
 * Cron aynı işi yeniden tetikleyebiliyor; damga gönderimden **önce**
 * yazılıyor ve `sentAt = null` koşuluyla güncelleniyor, böylece ikinci
 * tetikleme aynı uyarıyı bir daha göndermiyor (TUZAKLAR #28).
 */
export const maxDuration = 60;

export async function GET(request: Request) {
  // Vercel Cron `Authorization: Bearer <CRON_SECRET>` gönderiyor.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = request.headers.get("authorization");
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ hata: "Yetkisiz" }, { status: 401 });
    }
  }

  if (!isPushConfigured()) {
    return NextResponse.json({ atlandi: "VAPID anahtarları tanımlı değil" });
  }

  const now = new Date();
  const { start, end } = reminderWindow(now);

  const items = await prisma.item.findMany({
    where: {
      warrantyEndDate: { gte: start, lt: end },
      // Emekli ve satılmış ekipmanın garantisi kimseyi ilgilendirmiyor.
      status: { in: ["IN_USE", "IN_REPAIR"] },
    },
    select: {
      id: true,
      name: true,
      locationId: true,
      warrantyEndDate: true,
    },
  });

  const planned = planReminders(
    items.flatMap((item) =>
      item.warrantyEndDate
        ? [
            {
              itemId: item.id,
              itemName: item.name,
              locationId: item.locationId,
              warrantyEndDate: item.warrantyEndDate,
            },
          ]
        : [],
    ),
    now,
  );

  let sent = 0;
  let removed = 0;
  let skipped = 0;

  for (const reminder of planned) {
    // Damgayı önce yaz: yarışta ikinci tetikleme burada eli boş dönsün.
    const reminderRow = await prisma.itemReminder.upsert({
      where: {
        itemId_kind_dueDate_leadDays: {
          itemId: reminder.itemId,
          kind: "WARRANTY",
          dueDate: reminder.warrantyEndDate,
          leadDays: reminder.leadDays,
        },
      },
      create: {
        itemId: reminder.itemId,
        kind: "WARRANTY",
        dueDate: reminder.warrantyEndDate,
        leadDays: reminder.leadDays,
      },
      update: {},
      select: { id: true, sentAt: true },
    });

    if (reminderRow.sentAt) {
      skipped += 1;
      continue;
    }

    const stamped = await prisma.itemReminder.updateMany({
      where: { id: reminderRow.id, sentAt: null },
      data: { sentAt: new Date() },
    });
    if (stamped.count === 0) {
      skipped += 1;
      continue;
    }

    const members = await prisma.locationMember.findMany({
      where: { locationId: reminder.locationId },
      select: { userId: true },
    });

    // Gönderimi await et; yanıttan sonra iş yapılmıyor (TUZAKLAR #1).
    const result = await sendToUsers(
      members.map((member) => member.userId),
      warrantyPushPayload(reminder),
    );
    sent += result.sent;
    removed += result.removed;
  }

  return NextResponse.json({
    bakilan: items.length,
    planlanan: planned.length,
    gonderilen: sent,
    atlanan: skipped,
    silinenAbonelik: removed,
  });
}
