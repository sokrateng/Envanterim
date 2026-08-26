"use client";

import { useEffect, useRef } from "react";

/**
 * iOS uyarı penceresi görünümünde onay kutusu.
 *
 * Tarayıcının `confirm()` kutusu masaüstü görünümlü, adres çubuğuna yapışık ve
 * biçimlendirilemiyor; uygulamanın geri kalanıyla aynı dilde konuşmuyor
 * (docs/TASARIM.md). Bu yüzden kendi kutumuz: ortada, iki düğmeli, yıkıcı olan
 * kırmızı.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = "Vazgeç",
  tone = "red",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "red" | "blue";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Odak kutunun içinde başlasın: arkadaki forma yazmaya devam edilmesin.
    cancelButton.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/40 px-8"
      // Dışına dokunmak "vazgeç" sayılıyor: yıkıcı olan asla kazara seçilmiyor.
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-[280px] overflow-hidden rounded-[14px] bg-surface text-center"
      >
        <div className="px-4 py-4">
          <p className="text-headline">{title}</p>
          {message ? (
            <p className="pt-1 text-footnote text-muted">{message}</p>
          ) : null}
        </div>
        <div className="grid grid-cols-2 border-t border-separator divide-x divide-separator">
          <button
            ref={cancelButton}
            type="button"
            onClick={onCancel}
            className="min-h-touch px-3 text-body text-blue active:bg-surface-pressed"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-touch px-3 text-headline active:bg-surface-pressed ${
              tone === "red" ? "text-red" : "text-blue"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
