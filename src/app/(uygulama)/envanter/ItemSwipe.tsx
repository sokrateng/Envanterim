"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SwipeRow, type SwipeAction } from "@/components/SwipeRow";

/**
 * Envanter satırının kaydırma kısayolları.
 *
 * Kısayol, ekipman sayfasındaki işlemin aynısı — jesti bilmeyen hiçbir şey
 * kaybetmiyor. Sola çekince sağdan: bekleyen zimmeti üzerine alma, servise/
 * kullanıma alma, zimmet. Sağa çekince soldan: düzenleme.
 */
export function ItemSwipe({
  itemId,
  name,
  pendingAssignmentId,
  status,
  editable,
  children,
}: {
  itemId: string;
  name: string;
  /** Bu kullanıcının onayını bekleyen zimmet varsa kimliği. */
  pendingAssignmentId: string | null;
  status: string;
  editable: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function accept() {
    if (!pendingAssignmentId || busy) return;
    setBusy(true);
    await fetch(`/api/zimmet/${pendingAssignmentId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ islem: "KABUL" }),
    });
    setBusy(false);
    router.refresh();
  }

  async function toggleStatus() {
    if (busy) return;
    setBusy(true);
    await fetch(`/api/ekipman/${itemId}/durum`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status: status === "IN_REPAIR" ? "IN_USE" : "IN_REPAIR",
      }),
    });
    setBusy(false);
    router.refresh();
  }

  const actions: SwipeAction[] = [];
  if (pendingAssignmentId) {
    actions.push({ label: "Üzerime al", onSelect: accept });
  }
  if (editable) {
    actions.push({
      label: status === "IN_REPAIR" ? "Kullanımda" : "Serviste",
      onSelect: toggleStatus,
      tone: status === "IN_REPAIR" ? "blue" : "red",
    });
  }
  actions.push({
    label: "Zimmet",
    onSelect: () => router.push(`/envanter/${itemId}#zimmet`),
  });

  // Düzenleme formu ekipman sayfasında; adresteki bayrak paneli açık getiriyor.
  const leadingActions: SwipeAction[] = editable
    ? [
        {
          label: "Düzenle",
          onSelect: () => router.push(`/envanter/${itemId}?duzenle=1`),
        },
      ]
    : [];

  return (
    <SwipeRow label={name} actions={actions} leadingActions={leadingActions}>
      {children}
    </SwipeRow>
  );
}
