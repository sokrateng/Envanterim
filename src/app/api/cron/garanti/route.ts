import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { TimelineEvent } from "@/lib/events";
import {
  maintenancePushBody,
  ruleStatus,
  statusText,
} from "@/lib/maintenance";
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

  const bakim = await sendMaintenance(now);

  return NextResponse.json({
    bakilan: items.length,
    planlanan: planned.length,
    gonderilen: sent,
    atlanan: skipped,
    silinenAbonelik: removed,
    bakim,
  });
}

/**
 * Tekrarlayan bakım hatırlatmaları. Zamanı gelen (ya da eşiğe giren) kural
 * için bir bildirim gider.
 *
 * Aynı uyarının tekrar gitmemesi için `lastNotifiedCycle` damgalanıyor:
 * zaman kuralında kaçıncı dönem, sayaç kuralında kaçıncı tur olduğunu
 * tutuyor. Damga gönderimden **önce** yazılıyor (TUZAKLAR #28).
 */
async function sendMaintenance(now: Date) {
  const rules = await prisma.maintenanceRule.findMany({
    where: { item: { status: { in: ["IN_USE", "IN_REPAIR"] } } },
    select: {
      id: true,
      name: true,
      everyMonths: true,
      everyReading: true,
      readingUnit: true,
      leadDays: true,
      lastNotifiedCycle: true,
      item: {
        select: {
          id: true,
          name: true,
          locationId: true,
          purchaseDate: true,
          events: { select: { kind: true, date: true, readingValue: true } },
        },
      },
    },
  });

  let sent = 0;
  let removed = 0;
  let skipped = 0;

  for (const rule of rules) {
    const events = rule.item.events.map((event) => ({
      kind: event.kind as TimelineEvent["kind"],
      date: event.date,
      readingValue: event.readingValue,
    }));

    const status = ruleStatus(rule, {
      events,
      purchaseDate: rule.item.purchaseDate,
      now,
    });

    if (status.state !== "due" && status.state !== "soon") continue;

    // Dönem numarası: sayaçta tur, zamanda son bakımdan bu yana geçen dönem.
    const cycle =
      status.kind === "reading"
        ? (status.cycle ?? 0)
        : status.dueDate
          ? Math.floor(status.dueDate.getTime() / 86_400_000)
          : 0;

    if (rule.lastNotifiedCycle === cycle) {
      skipped += 1;
      continue;
    }

    const stamped = await prisma.maintenanceRule.updateMany({
      where: { id: rule.id, lastNotifiedCycle: rule.lastNotifiedCycle },
      data: { lastNotifiedCycle: cycle },
    });
    if (stamped.count === 0) {
      skipped += 1;
      continue;
    }

    const members = await prisma.locationMember.findMany({
      where: { locationId: rule.item.locationId },
      select: { userId: true },
    });

    const result = await sendToUsers(
      members.map((member) => member.userId),
      {
        title: "Bakım zamanı",
        body: maintenancePushBody(rule.item.name, rule, status),
        url: `/envanter/${rule.item.id}`,
        tag: `bakim-${rule.id}-${cycle}`,
      },
    );
    sent += result.sent;
    removed += result.removed;
    // statusText yalnız metin üretiyor; burada çağırmak günlüğe yazmak için.
    console.log("bakım bildirimi", rule.item.name, statusText(rule, status));
  }

  return { kural: rules.length, gonderilen: sent, atlanan: skipped, silinenAbonelik: removed };
}
