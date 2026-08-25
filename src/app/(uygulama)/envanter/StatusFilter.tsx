"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ITEM_STATUS, ITEM_STATUS_LABELS, type ItemStatus } from "@/lib/constants";

/** Segmented control — açılır menü yerine tek dokunuş (docs/TASARIM.md). */
export function StatusFilter({ value }: { value: ItemStatus | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function select(next: ItemStatus | null) {
    const query = new URLSearchParams(params.toString());
    if (next) query.set("durum", next);
    else query.delete("durum");
    router.replace(`${pathname}?${query.toString()}`);
  }

  const options: Array<{ key: string; label: string; value: ItemStatus | null }> = [
    { key: "hepsi", label: "Tümü", value: null },
    ...ITEM_STATUS.map((status) => ({
      key: status,
      label: ITEM_STATUS_LABELS[status],
      value: status,
    })),
  ];

  return (
    <div
      role="tablist"
      aria-label="Durum filtresi"
      className="flex gap-1 overflow-x-auto rounded-card bg-separator/40 p-1"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.key}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => select(option.value)}
            // flex-1 tek başına içeriğin altına küçülüp etiketleri üst üste
            // bindiriyordu; basis-0 + min-w-fit eşit genişlik verir, sığmazsa
            // çubuk yatayda kayar.
            className={`min-h-[36px] flex-1 basis-0 min-w-fit whitespace-nowrap rounded-[8px] px-2.5 text-footnote transition active:scale-95 ${
              active ? "bg-surface text-ink shadow-sm" : "text-muted"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
