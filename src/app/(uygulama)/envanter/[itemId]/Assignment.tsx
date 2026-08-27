"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/Sheet";
import { Badge, Fold } from "@/components/ui";
import { Field, FormError, SubmitButton, inputClass } from "@/components/form";
import { ASSIGNMENT_STATE_LABELS, type AssignmentState } from "@/lib/constants";
import { useCloseAndRefresh } from "@/lib/history-layer";

export type AssignmentView = {
  id: string;
  state: AssignmentState;
  holderName: string;
  assignedByName: string;
  assignedOn: string;
  pendingDays: number;
  overdue: boolean;
  note: string | null;
  canRespond: boolean;
  /** Kişinin kendisi mi cevap veriyor — "Üzerime al" ile "Teslim edildi" farkı. */
  self: boolean;
};

/**
 * Zimmet kartı — teslim–tesellüm.
 *
 * Atama tek başına teslim değil: kişi "Üzerime al" diyene kadar ekipman
 * bekliyor sayılıyor ve raporda duruyor. Hesabı olmayan biri için teslimi
 * sahibi/düzenleyen onun adına işaretliyor; kimin işaretlediği kayda geçiyor.
 */
export function Assignment({
  itemId,
  active,
  members,
  componentCount,
  editable,
}: {
  itemId: string;
  active: AssignmentView | null;
  members: Array<{ id: string; name: string }>;
  componentCount: number;
  editable: boolean;
}) {
  const router = useRouter();
  const closeAndRefresh = useCloseAndRefresh();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [holderKind, setHolderKind] = useState<"member" | "name">(
    members.length ? "member" : "name",
  );

  async function assign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/ekipman/${itemId}/zimmet`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        holderUserId: holderKind === "member" ? String(form.get("holderUserId") ?? "") : "",
        holderName: holderKind === "name" ? String(form.get("holderName") ?? "") : "",
        note: String(form.get("note") ?? ""),
        withComponents: form.get("withComponents") === "on",
      }),
    });

    setPending(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "Zimmet verilemedi");
      return;
    }
    closeAndRefresh(() => setOpen(false));
  }

  async function respond(islem: "KABUL" | "RED" | "IADE") {
    if (!active) return;
    setError(null);

    const response = await fetch(`/api/zimmet/${active.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ islem }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "İşlem tamamlanamadı");
      return;
    }
    router.refresh();
  }

  return (
    <Fold id="zimmet" title="Zimmet" count={active ? 1 : 0}>
      <div className="overflow-hidden rounded-card bg-bg">
        {active ? (
          <>
            <div className="flex min-h-touch items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-headline">{active.holderName}</span>
                  <Badge
                    tone={
                      active.state === "HELD"
                        ? "green"
                        : active.overdue
                          ? "red"
                          : "orange"
                    }
                  >
                    {ASSIGNMENT_STATE_LABELS[active.state]}
                  </Badge>
                </div>
                <span className="block truncate text-footnote text-muted">
                  {active.state === "PENDING"
                    ? `${active.assignedByName} verdi · ${active.pendingDays} gündür bekliyor`
                    : `${active.assignedByName} verdi · ${active.assignedOn}`}
                </span>
                {active.note ? (
                  <span className="block truncate text-footnote text-muted">
                    {active.note}
                  </span>
                ) : null}
              </div>
            </div>

            {active.canRespond ? (
              <div className="flex gap-2 border-t border-separator px-4 py-2.5">
                {active.state === "PENDING" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => respond("KABUL")}
                      className="min-h-touch flex-1 rounded-card bg-blue px-3 text-headline text-white transition active:scale-95"
                    >
                      {active.self ? "Üzerime al" : "Teslim edildi"}
                    </button>
                    <button
                      type="button"
                      onClick={() => respond("RED")}
                      className="min-h-touch flex-1 rounded-card bg-surface px-3 text-headline text-red transition active:scale-95"
                    >
                      {active.self ? "Bende değil" : "Kabul etmedi"}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => respond("IADE")}
                    className="min-h-touch flex-1 rounded-card bg-surface px-3 text-headline text-blue transition active:scale-95"
                  >
                    İade al
                  </button>
                )}
              </div>
            ) : null}
          </>
        ) : (
          <p className="px-4 py-3 text-footnote text-muted">
            Zimmetsiz. Kimin kullandığını yazarsan servise giderken, taşınırken
            ve “bu kimde?” derken aramazsın.
          </p>
        )}
      </div>

      {editable ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-touch pt-2 text-body text-blue active:opacity-60"
        >
          {active ? "Devret" : "+ Zimmet ver"}
        </button>
      ) : null}

      {error ? (
        <p role="alert" className="pt-2 text-footnote text-red">
          {error}
        </p>
      ) : null}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={active ? "Devret" : "Zimmet ver"}
        guardUnsaved
      >
        <form onSubmit={assign} className="max-h-[70dvh] overflow-y-auto pb-2">
          {members.length ? (
            <div className="flex gap-2 px-4 pb-3">
              <TabButton
                active={holderKind === "member"}
                onClick={() => setHolderKind("member")}
              >
                Üye
              </TabButton>
              <TabButton
                active={holderKind === "name"}
                onClick={() => setHolderKind("name")}
              >
                Hesapsız kişi
              </TabButton>
            </div>
          ) : null}

          {holderKind === "member" ? (
            <Field label="Kime" hint="Kişi kendi ekranından teslimi onaylar.">
              <select name="holderUserId" defaultValue="" className={inputClass} required>
                <option value="" disabled>
                  Seç
                </option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field
              label="Kime"
              hint="Hesabı olmayan kişi için teslimi sen işaretlersin."
            >
              <input
                name="holderName"
                className={inputClass}
                placeholder="Eylül Çoban"
                required
              />
            </Field>
          )}

          <Field label="Not">
            <input name="note" className={inputClass} placeholder="Okul için" />
          </Field>

          {componentCount ? (
            <label className="flex min-h-touch items-center justify-between gap-3 px-4">
              <span className="text-body">
                Bileşenler de gitsin ({componentCount})
              </span>
              <input
                type="checkbox"
                name="withComponents"
                defaultChecked
                className="h-6 w-6 accent-[var(--ios-blue)]"
              />
            </label>
          ) : null}

          <FormError message={error} />
          <SubmitButton pending={pending}>
            {active ? "Devret" : "Zimmetle"}
          </SubmitButton>
        </form>
      </Sheet>
    </Fold>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-touch flex-1 rounded-card px-3 text-subheadline transition active:scale-95 ${
        active ? "bg-blue text-white" : "bg-bg text-blue"
      }`}
    >
      {children}
    </button>
  );
}
