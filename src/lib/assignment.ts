import {
  ASSIGNMENT_OVERDUE_DAYS,
  ASSIGNMENT_STATE_LABELS,
  type AssignmentCloseReason,
  type AssignmentState,
  type Role,
} from "@/lib/constants";
import { canEdit } from "@/lib/permissions";

/**
 * Zimmet — teslim–tesellüm kuralları. Saf ve testli.
 *
 * Ekipmanın sorumlusu bir alan değil, kapanmamış zimmet kaydıdır: durum
 * tarihlerden türetiliyor (CLAUDE.md "türetilmiş değeri saklama"). Atama tek
 * başına yeterli sayılmıyor — teslim ancak karşı taraf (ya da onun adına
 * sahibi/düzenleyen) onayladığında gerçekleşmiş oluyor; onaylanmayanlar
 * raporda duruyor.
 */

export type AssignmentRecord = {
  id: string;
  holderUserId: string | null;
  holderName: string | null;
  assignedAt: Date;
  acceptedAt: Date | null;
  closedAt: Date | null;
  closedReason: string | null;
};

export function assignmentState(record: AssignmentRecord): AssignmentState {
  if (record.closedAt) {
    if (record.closedReason === "DECLINE") return "DECLINED";
    if (record.closedReason === "TRANSFER") return "TRANSFERRED";
    return "RETURNED";
  }
  return record.acceptedAt ? "HELD" : "PENDING";
}

export function stateLabel(record: AssignmentRecord): string {
  return ASSIGNMENT_STATE_LABELS[assignmentState(record)];
}

/** Açık zimmet: ekipman şu an kimde ya da kime gitmeyi bekliyor. */
export function activeAssignment<T extends AssignmentRecord>(
  records: T[],
): T | null {
  const open = records.filter((record) => !record.closedAt);
  if (!open.length) return null;

  // Aynı anda birden çok açık kayıt olmamalı; olursa en yenisi geçerli
  // sayılır ki ekran hiçbir zaman boş kalmasın.
  return open.reduce((latest, record) =>
    record.assignedAt.getTime() > latest.assignedAt.getTime() ? record : latest,
  );
}

export type HolderView = {
  userId: string | null;
  name: string;
  /** Hesabı olmayan kişi kendi onayını veremez. */
  hasAccount: boolean;
};

export function holderView(
  record: AssignmentRecord,
  userName?: string | null,
): HolderView {
  if (record.holderUserId) {
    return {
      userId: record.holderUserId,
      name: userName ?? "Üye",
      hasAccount: true,
    };
  }
  return {
    userId: null,
    name: record.holderName ?? "Bilinmiyor",
    hasAccount: false,
  };
}

/** Kaç gündür teslim bekliyor. Kabul edilmişse 0. */
export function pendingDays(
  record: AssignmentRecord,
  now: Date = new Date(),
): number {
  if (assignmentState(record) !== "PENDING") return 0;
  const ms = now.getTime() - record.assignedAt.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function isOverdue(
  record: AssignmentRecord,
  now: Date = new Date(),
  limit: number = ASSIGNMENT_OVERDUE_DAYS,
): boolean {
  return pendingDays(record, now) >= limit;
}

export type Viewer = { userId: string; role: Role };

/**
 * Kabul/red kimden gelebilir: kişinin kendisinden, ya da sahibi/düzenleyenden
 * "elden teslim ettim" olarak. Kimin işaretlediği kayda geçiyor, bu yüzden
 * adına işaretleme izi kaybolmuyor.
 */
export function canRespond(record: AssignmentRecord, viewer: Viewer): boolean {
  if (record.closedAt) return false;
  if (record.holderUserId && record.holderUserId === viewer.userId) return true;
  return canEdit({ role: viewer.role });
}

/** Kişinin kendi zimmeti mi — arayüz "Üzerime al" mı "Teslim edildi" mi yazacak. */
export function isSelf(record: AssignmentRecord, viewer: Viewer): boolean {
  return Boolean(record.holderUserId) && record.holderUserId === viewer.userId;
}

/** Zimmet verme/iade/devir yetkisi lokasyon üyeliğinden geçer. */
export function canAssign(viewer: Viewer): boolean {
  return canEdit({ role: viewer.role });
}

/** Kapatma nedeninin zaman çizelgesinde nasıl okunacağı. */
export function closeText(
  reason: AssignmentCloseReason,
  holder: string,
  next?: string | null,
): string {
  switch (reason) {
    case "TRANSFER":
      return next ? `${holder} → ${next}` : `${holder} devretti`;
    case "DECLINE":
      return `${holder} kabul etmedi`;
    case "RETURN":
      return `${holder} iade etti`;
  }
}

/**
 * Zaman çizelgesine yazılacak not. Üye sorumluda ad zaten olayın kendisinden
 * geliyor (`assignedToUser`); not ada bir daha yer verirse satır kendini
 * tekrar ediyor. Hesapsız kişide ad yalnız burada duruyor.
 */
export function eventNote(
  holder: HolderView,
  action: string,
  markedBy?: string | null,
): string {
  const text = markedBy ? `${action} (${markedBy} işaretledi)` : action;
  return holder.hasAccount ? text : `${holder.name} · ${text}`;
}

/** Ekipman satırında görünen kısa sorumlu metni. */
export function holderSummary(
  record: AssignmentRecord | null,
  userName?: string | null,
): string {
  if (!record) return "Zimmetsiz";
  const holder = holderView(record, userName);
  return assignmentState(record) === "PENDING"
    ? `${holder.name} · bekliyor`
    : holder.name;
}
