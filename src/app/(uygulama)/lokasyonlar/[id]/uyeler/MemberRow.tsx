"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/constants";

export function MemberRow({
  locationId,
  memberId,
  name,
  username,
  role,
  isSelf,
  canManage,
  isLastOwner,
  badge,
}: {
  locationId: string;
  memberId: string;
  name: string;
  username: string;
  role: Role;
  isSelf: boolean;
  canManage: boolean;
  isLastOwner: boolean;
  badge?: ReactNode;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(method: "PATCH" | "DELETE", body?: unknown) {
    setBusy(true);
    setError(null);
    const response = await fetch(
      `/api/lokasyonlar/${locationId}/uyeler/${memberId}`,
      {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      },
    );
    setBusy(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "İşlem tamamlanamadı");
      return;
    }
    router.refresh();
  }

  return (
    <div className="py-2.5 pl-4 pr-4">
      <div className="flex min-h-touch items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-headline">{name}</span>
            {isSelf ? (
              <span className="shrink-0 text-caption text-muted">(sen)</span>
            ) : null}
            {badge}
          </div>
          <div className="truncate text-footnote text-muted">@{username}</div>
        </div>

        {canManage ? (
          <select
            aria-label={`${name} rolü`}
            value={role}
            disabled={busy || isLastOwner}
            onChange={(e) => send("PATCH", { role: e.target.value })}
            className="min-h-touch rounded-card border border-separator bg-bg px-2 text-subheadline disabled:opacity-50"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-subheadline text-muted">{ROLE_LABELS[role]}</span>
        )}

        {canManage && !isLastOwner ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => send("DELETE")}
            className="min-h-touch px-2 text-subheadline text-red active:opacity-60 disabled:opacity-50"
          >
            Çıkar
          </button>
        ) : null}
      </div>

      {isLastOwner && canManage ? (
        <p className="pt-1 text-caption text-muted">
          Son sahip: rolü değiştirilemez, çıkarılamaz.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="pt-1 text-footnote text-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}
