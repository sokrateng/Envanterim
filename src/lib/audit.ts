import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Denetim izi. Paylaşılan bir envanterde "bu kayıt nereye gitti" sorusunun
 * tek cevabı bu — ekipman silinmiyor ama olay, parça ve ek siliniyor.
 *
 * Yazmak sessizce başarısız oluyor: iz tutulamadı diye kullanıcının işlemi
 * geri alınmaz. Gönderim yanıt öncesinde `await` ediliyor (TUZAKLAR #1).
 */
export type AuditAction = "CREATE" | "UPDATE" | "DELETE";

export type AuditEntity =
  | "ITEM"
  | "EVENT"
  | "PART"
  | "ATTACHMENT"
  | "MEMBER"
  | "CATEGORY"
  | "SHARE"
  | "LOCATION"
  | "ASSIGNMENT";

export const AUDIT_ENTITY_LABELS: Record<AuditEntity, string> = {
  ITEM: "Ekipman",
  EVENT: "Zaman çizelgesi",
  PART: "Yedek parça",
  ATTACHMENT: "Ek",
  MEMBER: "Üye",
  CATEGORY: "Kategori",
  SHARE: "Paylaşım",
  LOCATION: "Lokasyon",
  ASSIGNMENT: "Zimmet",
};

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  CREATE: "eklendi",
  UPDATE: "değişti",
  DELETE: "silindi",
};

export async function logAudit(entry: {
  locationId: string;
  userId: string | null;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string | null;
  summary: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        locationId: entry.locationId,
        userId: entry.userId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        summary: entry.summary.slice(0, 300),
      },
    });
  } catch (error) {
    console.error("denetim izi yazılamadı", (error as Error).message);
  }
}
