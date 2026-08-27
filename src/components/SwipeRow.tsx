"use client";

import { useEffect, useRef, useState } from "react";
import {
  clampOffset,
  direction,
  settle,
  velocity,
  type Direction,
  type SwipeSide,
} from "@/lib/swipe";

/**
 * Kaydırınca altından işlem düğmeleri çıkan liste satırı: sola çekince sağdaki
 * (yıkıcı ve durum işlemleri), sağa çekince soldaki (düzenleme).
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
  leadingActions = [],
  children,
  label,
}: {
  actions: SwipeAction[];
  /** Sağa kaydırınca soldan çıkanlar. */
  leadingActions?: SwipeAction[];
  children: React.ReactNode;
  /** Ekran okuyucu için: hangi satırın işlemleri. */
  label: string;
}) {
  const surface = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const leadingPanel = useRef<HTMLDivElement>(null);
  const gesture = useRef<{
    x: number;
    y: number;
    at: number;
    axis: Direction;
    base: number;
  } | null>(null);

  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState<SwipeSide>(null);
  const [width, setWidth] = useState(0);
  const [leadingWidth, setLeadingWidth] = useState(0);

  useEffect(() => {
    if (panel.current) setWidth(panel.current.offsetWidth);
    if (leadingPanel.current) setLeadingWidth(leadingPanel.current.offsetWidth);
  }, [actions.length, leadingActions.length]);

  // Başka bir satır açılınca bu kapansın: aynı anda iki açık satır kafa
  // karıştırıyor ve dokunma hedefleri üst üste biniyor.
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (surface.current?.contains(event.target as Node)) return;
      setOpen(null);
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
      base: open === "trailing" ? -width : open === "leading" ? leadingWidth : 0,
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

    setOffset(clampOffset(state.base + dx, width, leadingWidth));
  }

  function onPointerUp(event: React.PointerEvent) {
    const state = gesture.current;
    gesture.current = null;
    if (!state || state.axis !== "horizontal") return;

    const dx = event.clientX - state.x;
    const speed = velocity(dx, event.timeStamp - state.at);
    const next = settle(state.base + dx, width, leadingWidth, speed);
    setOpen(next);
    setOffset(next === "trailing" ? -width : next === "leading" ? leadingWidth : 0);
  }

  function run(action: SwipeAction) {
    setOpen(null);
    setOffset(0);
    action.onSelect();
  }

  return (
    // Kabın kendi zemini var: açıkta kalan hat kartın rengine değil satırın
    // rengine düşsün, kap başka renkte bir kartın içine konsa bile.
    <div ref={surface} className="relative overflow-hidden bg-surface">
      {/* Kapalıyken `inert`: düğmeler ne dokunuşa ne ekran okuyucuya görünüyor.
          `aria-hidden` tek başına yetmiyor, öğe hâlâ tıklanabilir kalıyor. */}
      {/* Paneller satırın en üst ve en alt pikseline dayanmıyor: üstteki
          içerik katmanı `translate3d` yüzünden ayrı bir katman ve iOS onun
          yüksekliğini cihaz pikseline yuvarlarken bir hat açığa çıkıyor —
          satır aralarında mavi/kırmızı çizgiler görünüyordu. Eskiden bu
          pikseli ayracın kenarlığı kapatıyordu (TUZAKLAR #71). */}
      <div
        ref={leadingPanel}
        inert={open !== "leading"}
        className="absolute inset-y-px left-0 flex"
      >
        {leadingActions.map((action) => (
          <button
            key={action.label}
            type="button"
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
        ref={panel}
        inert={open !== "trailing"}
        className="absolute inset-y-px right-0 flex"
      >
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
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
