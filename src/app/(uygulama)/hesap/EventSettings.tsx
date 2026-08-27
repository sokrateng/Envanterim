"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Envanter olayı bildirimleri: hangi olayda haber isteniyor.
 *
 * Tercih kanaldan bağımsız — kapalıysa ne push ne e-posta gider. Aynı
 * lokasyondaki iki kullanıcı farklı seçebiliyor: biri yeni ekipmanı duymak
 * isteyip değişiklikleri istemeyebilir.
 */
export function EventSettings({
  newItem,
  itemChange,
}: {
  newItem: boolean;
  itemChange: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Anahtar hemen hareket ediyor, sunucu yanıtı beklenmiyor: dokunup bir şey
  // olmaması "çalışmadı" hissi veriyor. Hata olursa eski hâline dönüyor.
  const [state, setState] = useState({ newItem, itemChange });

  async function save(
    patch: { yeniEkipman?: boolean; degisiklik?: boolean },
    optimistic: { newItem: boolean; itemChange: boolean },
  ) {
    const previous = state;
    setState(optimistic);
    setBusy(true);
    setError(null);

    const response = await fetch("/api/hesap/bildirim", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    setBusy(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.hata ?? "Ayar kaydedilemedi");
      setState(previous);
      return;
    }
    router.refresh();
  }

  return (
    <div className="border-t border-separator px-4 py-2">
      <Toggle
        label="Yeni ekipman eklenince"
        hint="Lokasyonuna ekipman ekleyen sen değilsen haber gelir."
        checked={state.newItem}
        busy={busy}
        onChange={(value) =>
          void save({ yeniEkipman: value }, { ...state, newItem: value })
        }
      />
      <Toggle
        label="Ekipman değişince"
        hint="Ad, durum, tutar, garanti… ne değiştiği bildirimde yazar."
        checked={state.itemChange}
        busy={busy}
        onChange={(value) =>
          void save({ degisiklik: value }, { ...state, itemChange: value })
        }
      />
      {error ? (
        <p role="alert" className="pb-2 text-footnote text-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  busy,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  busy: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="block py-2">
      <span className="flex min-h-touch items-center justify-between gap-3">
        <span className="text-body">{label}</span>
        <input
          type="checkbox"
          checked={checked}
          disabled={busy}
          onChange={(event) => onChange(event.target.checked)}
          className="h-6 w-6 shrink-0 accent-[var(--ios-blue)]"
        />
      </span>
      <span className="block text-footnote text-muted">{hint}</span>
    </label>
  );
}
