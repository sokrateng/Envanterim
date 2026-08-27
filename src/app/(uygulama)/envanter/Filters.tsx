"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Sheet } from "@/components/Sheet";
import { useCloseThen } from "@/lib/history-layer";
import { parseValues, toParam, toggleValue } from "@/lib/filter-values";

/**
 * Bütün filtreler tek düğmenin arkasında.
 *
 * Dört ayrı çip sırası (durum, lokasyon, kategori, zimmet) 390 pikselde
 * ekranın yarısını yiyor ve liste katlamanın altına düşüyordu. Düğmedeki sayı
 * kaç filtrenin açık olduğunu söylüyor; seçim panelde yapılıp bir kez
 * uygulanıyor — her dokunuşta sunucuya gitmek listeyi zıplatıyor.
 */

export type FilterOption = { value: string; label: string };

export type FilterGroup = {
  /** Adres çubuğundaki anahtar: durum, lokasyon, kategori, zimmet. */
  key: string;
  title: string;
  /** Hiçbiri seçilmediğinde görünen seçenek. */
  anyLabel: string;
  options: FilterOption[];
  /**
   * Birden fazla seçilebiliyor mu. Durum, lokasyon ve kategori öyle: "pasif
   * hariç hepsi" demenin yolu kalanları işaretlemek. Zimmet ve favori ise
   * birbirini dışlayan kipler, çoğullanmıyorlar.
   */
  multiple?: boolean;
};

export function Filters({
  groups,
  current,
}: {
  groups: FilterGroup[];
  current: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const closeThen = useCloseThen();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string | undefined>>(current);

  const activeCount = groups.filter((group) => current[group.key]).length;

  /** Gruptaki taslak seçim; çoklu grupta liste, tekli grupta tek elemanlı. */
  function secim(group: FilterGroup): string[] {
    return parseValues(
      draft[group.key],
      group.options.map((option) => option.value),
    );
  }

  function apply(values: Record<string, string | undefined>) {
    const query = new URLSearchParams(params.toString());
    for (const group of groups) {
      const value = values[group.key];
      if (value) query.set(group.key, value);
      else query.delete(group.key);
    }
    // Filtre değişince sayfa başa dönsün.
    query.delete("sayfa");
    const suffix = query.toString();
    const href = suffix ? `${pathname}?${suffix}` : pathname;
    // Önce panel kapansın: panelin geçmiş kaydı `history.back()` ile
    // düşürülüyor ve öncesinde yapılan replace geri alınıyor (TUZAKLAR #60).
    closeThen(
      () => setOpen(false),
      () => router.replace(href),
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDraft(current);
          setOpen(true);
        }}
        aria-label={
          activeCount ? `Filtreler — ${activeCount} açık` : "Filtreler"
        }
        className="relative grid h-touch w-touch shrink-0 place-items-center rounded-card border border-separator bg-surface text-blue active:opacity-60"
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="h-[22px] w-[22px]"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
        >
          <path d="M4 7h16M7 12h10M10 17h4" />
        </svg>
        {activeCount ? (
          <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-blue px-1 text-caption text-white">
            {activeCount}
          </span>
        ) : null}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Filtrele">
        {/* Her ölçüt kendi çerçevesinde: çipler sırayla dizilince hangi
            çipin hangi başlığa ait olduğu karışıyordu — 390 pikselde bir
            grubun son satırı bir sonrakinin ilk satırına yapışıyor. */}
        <div className="flex max-h-[65dvh] flex-col gap-2 overflow-y-auto pb-2">
          {groups.map((group) => (
            <section
              key={group.key}
              className="rounded-card border border-separator p-3"
            >
              <h3 className="pb-2 text-footnote uppercase text-muted">
                {group.title}
              </h3>
              <div className="flex flex-wrap gap-2">
                <ChipButton
                  label={group.anyLabel}
                  // Erişilebilir ad grubu da söylüyor: "Serviste" tek başına
                  // ekranın başka yerlerinde de geçiyor.
                  name={`${group.title}: ${group.anyLabel}`}
                  active={secim(group).length === 0}
                  onClick={() =>
                    setDraft((now) => ({ ...now, [group.key]: undefined }))
                  }
                />
                {group.options.map((option) => (
                  <ChipButton
                    key={option.value}
                    label={option.label}
                    name={`${group.title}: ${option.label}`}
                    active={secim(group).includes(option.value)}
                    onClick={() =>
                      setDraft((now) => ({
                        ...now,
                        [group.key]: group.multiple
                          ? toParam(toggleValue(secim(group), option.value))
                          : // Tek seçimli grupta aynı çipe tekrar dokunmak
                            // seçimi kaldırıyor: "Tümü"ye uzanmaya gerek yok.
                            secim(group).includes(option.value)
                            ? undefined
                            : option.value,
                      }))
                    }
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="flex gap-2 border-t border-separator pt-3">
          <button
            type="button"
            onClick={() => apply({})}
            className="min-h-touch flex-1 rounded-card bg-bg px-3 text-headline text-blue transition active:scale-95"
          >
            Temizle
          </button>
          <button
            type="button"
            onClick={() => apply(draft)}
            className="min-h-touch flex-[2] rounded-card bg-blue px-3 text-headline text-white transition active:scale-95"
          >
            Uygula
          </button>
        </div>
      </Sheet>
    </>
  );
}

function ChipButton({
  label,
  name,
  active,
  onClick,
}: {
  label: string;
  name: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={name}
      aria-pressed={active}
      // Seçilmemiş çip dolgu rengiyle duruyor: panelin zemini zaten
      // `surface`, aynı rengi vermek çipi görünmez yapardı.
      className={`min-h-touch whitespace-nowrap rounded-card px-3 text-footnote transition active:scale-95 ${
        active ? "bg-blue text-white" : "bg-fill text-ink"
      }`}
    >
      {label}
    </button>
  );
}
