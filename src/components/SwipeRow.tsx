"use client";

import { useEffect, useRef, useState } from "react";
import {
  clampOffset,
  direction,
  settleOpen,
  velocity,
  type Direction,
} from "@/lib/swipe";

/**
 * Sola kaydırınca altından işlem düğmeleri çıkan liste satırı.
 *
 * Üç kural (docs/TASARIM.md, TUZAKLAR #45):
 * - Jest dikey kaydırmayı çalmıyor; yön bir kez seçiliyor.
 * - Düğmeler jestsiz de erişilebilir: aynı işlemler ekipman sayfasında da var,
 *   burada kısayol. Jest bilmeyen kullanıcı hiçbir şey kaybetmiyor.
 * - Yıkıcı işlem tek dokunuşla bitmiyor; çağıran taraf "geri al" veriyor.
 */
export type SwipeAction = {
  label: string;
  onSelect: () => void;
  tone?: "blue" | "red";
};

export function SwipeRow({
  actions,
  children,
  label,
}: {
  actions: SwipeAction[];
  children: React.ReactNode;
  /** Ekran okuyucu için: hangi satırın işlemleri. */
  label: string;
}) {
  const surface = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const gesture = useRef<{
    x: number;
    y: number;
    at: number;
    axis: Direction;
    base: number;
  } | null>(null);

  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (panel.current) setWidth(panel.current.offsetWidth);
  }, [actions.length]);

  // Başka bir satır açılınca bu kapansın: aynı anda iki açık satır kafa
  // karıştırıyor ve dokunma hedefleri üst üste biniyor.
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (surface.current?.contains(event.target as Node)) return;
      setOpen(false);
      setOffset(0);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  function onPointerDown(event: React.PointerEvent) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    gesture.current = {
      x: event.clientX,
      y: event.clientY,
      at: event.timeStamp,
      axis: "unknown",
      base: open ? -width : 0,
    };
  }

  function onPointerMove(event: React.PointerEvent) {
    const state = gesture.current;
    if (!state) return;

    const dx = event.clientX - state.x;
    const dy = event.clientY - state.y;

    if (state.axis === "unknown") {
      state.axis = direction({ dx, dy });
      // Dikey seçildiyse jest bitti: liste normal kaysın.
      if (state.axis === "vertical") {
        gesture.current = null;
        return;
      }
      if (state.axis === "unknown") return;
    }

    setOffset(clampOffset(state.base + dx, width));
  }

  function onPointerUp(event: React.PointerEvent) {
    const state = gesture.current;
    gesture.current = null;
    if (!state || state.axis !== "horizontal") return;

    const dx = event.clientX - state.x;
    const speed = velocity(dx, event.timeStamp - state.at);
    const next = settleOpen(state.base + dx, width, speed);
    setOpen(next);
    setOffset(next ? -width : 0);
  }

  function run(action: SwipeAction) {
    setOpen(false);
    setOffset(0);
    action.onSelect();
  }

  return (
    <div ref={surface} className="relative overflow-hidden">
      <div
        ref={panel}
        aria-hidden={!open}
        className="absolute inset-y-0 right-0 flex"
      >
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            tabIndex={open ? 0 : -1}
            aria-label={`${action.label}: ${label}`}
            onClick={() => run(action)}
            className={`min-h-touch w-20 px-2 text-subheadline text-white active:opacity-80 ${
              action.tone === "red" ? "bg-red" : "bg-blue"
            }`}
          >
            {action.label}
          </button>
        ))}
      </div>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          transform: `translate3d(${offset}px,0,0)`,
          // Sürerken geçiş yok: parmak nereye giderse oraya.
          transition: gesture.current ? undefined : "transform 180ms ease-out",
          // Yatay jest bize, dikey kaydırma tarayıcıya.
          touchAction: "pan-y",
        }}
        className="relative bg-surface"
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Yıkıcı işlem için geri alma şeridi. Silme hemen yapılmıyor; süre dolmadan
 * "Geri al" denirse hiç yapılmıyor — dokunmatikte kazara silme çok kolay.
 */
export function UndoBar({
  message,
  onUndo,
}: {
  message: string;
  onUndo: () => void;
}) {
  return (
    <div
      role="status"
      className="mx-4 mt-2 flex min-h-touch items-center justify-between gap-3 rounded-card bg-ink/85 px-4 text-white"
    >
      <span className="truncate text-subheadline">{message}</span>
      <button
        type="button"
        onClick={onUndo}
        className="min-h-touch shrink-0 px-2 text-headline text-white underline active:opacity-70"
      >
        Geri al
      </button>
    </div>
  );
}
