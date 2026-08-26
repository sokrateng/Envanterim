"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useHistoryLayer } from "@/lib/history-layer";

/**
 * Alttan açılan panel — yeni kayıt ve düzenleme bunun içinde açılır
 * (docs/TASARIM.md). Tam sayfa yerine panel: bağlam kaybolmuyor.
 *
 * `guardUnsaved` verilen panellerde bir alana dokunulmuşsa kapatma isteği önce
 * soruluyor. "Dokunuldu mu" bilgisi panelin içinden geliyor: alanlar denetimsiz
 * (`defaultValue`) olduğu için değeri karşılaştırmak yerine kabarcıklanan
 * girdi olaylarını dinliyoruz — her forma ayrı ayrı bayrak taşımak gerekmiyor.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  guardUnsaved = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Veri girilen paneller için: kaydedilmeden çıkışta onay sorulur. */
  guardUnsaved?: boolean;
}) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const dirty = useRef(false);
  const [asking, setAsking] = useState(false);

  const layer = useRef<{ restore: () => void }>({ restore: () => undefined });

  /** Kullanıcının kapatma isteği: kirliyse önce sorulur. */
  const close = useCallback(() => {
    if (guardUnsaved && dirty.current) {
      setAsking(true);
      // Geri tuşundan geldiyse katmanın kaydı düşmüş olur; iptal edilirse
      // panel açık kalacağı için kaydı hemen geri koyuyoruz.
      layer.current.restore();
      return;
    }
    onClose();
  }, [guardUnsaved, onClose]);

  layer.current = useHistoryLayer(open, close, id);

  // Panel her açılışta temiz başlıyor.
  useEffect(() => {
    if (open) {
      dirty.current = false;
      setAsking(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      // Arka katmana dokunmak kapatır; panelin kendi dokunuşu buraya
      // sızmasın diye içeride durduruluyor (TUZAKLAR #16).
      onClick={close}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        onInput={() => {
          dirty.current = true;
        }}
        onChange={() => {
          dirty.current = true;
        }}
        className="w-full max-w-[430px] rounded-t-sheet bg-surface pb-[calc(env(safe-area-inset-bottom)+16px)] sheet-in"
      >
        <div className="flex justify-center pt-2">
          <span className="h-1 w-9 rounded-full bg-separator" aria-hidden />
        </div>
        <div className="flex min-h-touch items-center justify-between px-4">
          <h2 className="text-headline">{title}</h2>
          <button
            type="button"
            onClick={close}
            className="-mr-2 h-touch w-touch text-body text-blue active:opacity-60"
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>
        <div className="px-4 pt-1">{children}</div>
      </div>

      <ConfirmDialog
        open={asking}
        title="Kaydedilmemiş değişiklikler"
        message="Girdiklerin kaybolacak. Yine de çıkmak istiyor musun?"
        confirmLabel="Çık"
        cancelLabel="Kalmaya devam et"
        onConfirm={() => {
          setAsking(false);
          dirty.current = false;
          onClose();
        }}
        onCancel={() => setAsking(false)}
      />
    </div>
  );
}
