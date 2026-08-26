"use client";

import { Sheet } from "@/components/Sheet";
import type { InvoiceFormValues } from "@/lib/invoice";

/**
 * Faturada birden çok kalem varsa hangisinin bu ekipman olduğunu sorar.
 *
 * Hem var olan ekipmanın ekinden hem yeni ekipman formundan aynı soru
 * soruluyor; seçim ikisinde de forma doldurup kullanıcıya onaylatıyor
 * (CLAUDE.md, TUZAKLAR #36).
 */
export function InvoiceLines({
  lines,
  note,
  onPick,
  onClose,
}: {
  lines: InvoiceFormValues[] | null;
  note: string | null;
  onPick: (line: InvoiceFormValues) => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={lines !== null} onClose={onClose} title="Faturadaki kalemler">
      <p className="pt-2 text-footnote text-muted">
        Faturada birden fazla kalem var. Bu ekipman hangisi? Seçtiğin kalem
        forma doldurulur, kaydetmeden önce kontrol edersin.
      </p>
      {note ? (
        <p className="pt-2 text-footnote text-orange">Model notu: {note}</p>
      ) : null}
      <ul className="mt-3 divide-y divide-separator overflow-hidden rounded-card bg-bg">
        {(lines ?? []).map((line, index) => (
          <li key={`${line.name}-${index}`}>
            <button
              type="button"
              onClick={() => onPick(line)}
              className="flex min-h-touch w-full flex-col items-start px-3 py-2 text-left active:bg-surface-pressed"
            >
              <span className="text-headline">{line.name}</span>
              <span className="text-footnote text-muted">
                {[line.brand, line.model, line.purchasePrice]
                  .filter(Boolean)
                  .join(" · ") || "Ayrıntı okunamadı"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
