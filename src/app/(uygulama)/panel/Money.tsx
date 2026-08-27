"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/Sheet";
import { Field, inputClass } from "@/components/form";
import { CURRENCY_LABELS } from "@/lib/constants";
import { tryTotal, type RateMap } from "@/lib/exchange";
import { formatMinor, formatMoney, parseMoney } from "@/lib/money";

/**
 * Sahip olma maliyeti kartı — tek bir TRY sayısı, kuru kullanıcı veriyor.
 *
 * Envanterdeki tutar alış anına ait ve uygulamanın hiçbir yerinde kur
 * tutulmuyor (CLAUDE.md: "kur çevirisi yok"). O kural uydurma bir sayıyı
 * korumak için vardı: bugünkü kuru bilmeden çevrilen toplam, kaynağı belirsiz
 * bir rakam olur. Tek toplam istendiğinde çözüm kuru **kullanıcıya sormak**:
 * kim hangi kurla topladığını görüyor, girmezse toplam eskisi gibi birim
 * başına ayrı duruyor.
 *
 * Kur tarayıcıda duruyor (cihaz başına). Sunucuya taşımak için şemaya bir
 * ayar tablosu gerekirdi; kur kişisel ve anlık bir görüntüleme tercihi,
 * envanterin verisi değil.
 */

const STORE_KEY = "envanterim:kur";

function readRates(): RateMap {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const rates: RateMap = {};
    for (const [code, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        rates[code] = Math.round(value);
      }
    }
    return rates;
  } catch {
    // Depo kapalı ya da içerik bozuk; kursuz devam ediyoruz.
    return {};
  }
}

function writeRates(rates: RateMap) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(rates));
  } catch {
    // Kur hatırlanamadı; ekran yine de doğru çalışıyor.
  }
}

export type CurrencyRow = {
  currency: string;
  itemCount: number;
  pricedCount: number;
  purchaseMinor: number;
  ownershipMinor: number;
};

export function Money({ rows }: { rows: CurrencyRow[] }) {
  const [rates, setRates] = useState<RateMap>({});
  const [open, setOpen] = useState(false);

  // Depo yalnız tarayıcıda okunuyor; ilk çizim sunucununkiyle aynı kalsın
  // diye bağlandıktan sonra tazeleniyor.
  useEffect(() => setRates(readRates()), []);

  const yabanci = rows
    .map((row) => row.currency)
    .filter((code) => code !== "TRY");

  const sahip = tryTotal(
    rows.map((row) => ({ currency: row.currency, minor: row.ownershipMinor })),
    rates,
  );
  const alis = tryTotal(
    rows.map((row) => ({ currency: row.currency, minor: row.purchaseMinor })),
    rates,
  );

  /** Kuru girilmiş ve toplama gerçekten girmiş yabancı birimler. */
  const cevrilen = yabanci.filter(
    (code) => rates[code] && sahip.converted.includes(code),
  );

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next: RateMap = {};
    for (const code of yabanci) {
      const minor = parseMoney(String(form.get(code) ?? ""));
      if (minor && minor > 0) next[code] = minor;
    }
    setRates(next);
    writeRates(next);
    setOpen(false);
  }

  return (
    <>
      <section className="mx-4 mt-3 rounded-card bg-surface p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-footnote uppercase text-muted">
            Sahip olma maliyeti
          </h2>
          {yabanci.length ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="min-h-touch text-footnote text-blue active:opacity-60"
            >
              Kur
            </button>
          ) : null}
        </div>

        {/* Panelin en büyük sayısı: alış + servis + parça. */}
        <p className="pt-2 text-large-title tabular-nums">
          {formatMoney(sahip.minor)}
        </p>
        <p className="text-footnote text-muted">
          Alış bedeli {formatMoney(alis.minor)}
        </p>

        {sahip.missing.length ? (
          <p className="pt-2 text-footnote text-orange">
            {sahip.missing.join(", ")} kuru girilmedi; bu birimdeki tutarlar
            toplama girmiyor.
          </p>
        ) : null}

        {/* Çevrilen her birimin kuru yazıyor: TRY'ye çevrilmiş bir toplamın
            yanında hangi kurun kullanıldığı görünmezse, sayı kaynağı belirsiz
            olur. Tek birim çevrildiğinde de yazıyor. */}
        {cevrilen.length ? (
          <p className="pt-1 text-caption text-muted">
            {cevrilen
              .map((code) => `1 ${code} = ${formatMinor(rates[code])} ₺`)
              .join(" · ")}{" "}
            — senin girdiğin kur.
          </p>
        ) : null}

        {rows.length > 1 ? (
          <ul className="mt-3 border-t border-separator pt-2">
            {rows.map((row) => (
              <li
                key={row.currency}
                className="flex items-baseline justify-between gap-3 py-1"
              >
                <span className="text-subheadline">
                  {CURRENCY_LABELS[row.currency] ?? row.currency}
                  <span className="text-muted"> · {row.itemCount} ekipman</span>
                </span>
                <span className="shrink-0 text-subheadline tabular-nums">
                  {formatMoney(row.ownershipMinor, row.currency)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <Sheet open={open} onClose={() => setOpen(false)} title="Kur" guardUnsaved>
        <form onSubmit={save} className="pb-2">
          <p className="pb-1 text-footnote text-muted">
            Bir birimin kaç lira olduğunu yaz; toplam bu kurla hesaplanıyor.
            Kur bu cihazda saklanıyor, envanterin verisine yazılmıyor.
          </p>
          {yabanci.map((code) => (
            <Field key={code} label={`1 ${code} kaç ₺`}>
              <input
                name={code}
                inputMode="decimal"
                defaultValue={rates[code] ? formatMinor(rates[code]) : ""}
                placeholder="0,00"
                className={inputClass}
              />
            </Field>
          ))}
          <button
            type="submit"
            className="mt-3 min-h-touch w-full rounded-card bg-blue px-4 text-headline text-white transition active:scale-95"
          >
            Kaydet
          </button>
        </form>
      </Sheet>
    </>
  );
}
