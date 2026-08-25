"use client";

import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { useHistoryLayer } from "@/lib/history-layer";

/**
 * Alttan açılan panel — yeni kayıt ve düzenleme bunun içinde açılır
 * (docs/TASARIM.md). Tam sayfa yerine panel: bağlam kaybolmuyor.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);

  const close = useCallback(() => onClose(), [onClose]);
  useHistoryLayer(open, close, id);

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
    </div>
  );
}
