"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useHistoryLayer } from "@/lib/history-layer";
import {
  IDENTITY,
  clampScale,
  distance,
  doubleTapScale,
  isZoomed,
  midpoint,
  pan,
  toTransform,
  zoomAt,
  type Point,
  type ZoomState,
} from "@/lib/zoom";

/**
 * Tam ekran görsel — parmakla büyütme kendi elimizde.
 *
 * PWA `display: standalone` iOS'ta sayfa yakınlaştırmasını kapatıyor
 * (TUZAKLAR #8); fatura ve ürün fotoğrafı büyütülebilsin diye hareketi
 * pointer olaylarıyla kendimiz ele alıyoruz. Matematik `src/lib/zoom.ts`'te
 * ve testli.
 */
export function ImageViewer({
  open,
  url,
  name,
  onClose,
}: {
  open: boolean;
  url: string;
  name: string;
  onClose: () => void;
}) {
  const id = useId();
  const surface = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<ZoomState>(IDENTITY);

  // Aktif parmaklar: pointerId → son konum.
  const pointers = useRef(new Map<number, Point>());
  const pinchStart = useRef<{ gap: number; scale: number } | null>(null);
  const lastTap = useRef(0);

  /**
   * Hareketin tamamının özeti. Buna bakmadan yalnız son parmağın kalkışına
   * bakmak iki parmaklı büyütmenin bitişini "çift dokunuş" sanıyor ve
   * kullanıcının az önce büyüttüğü görseli hemen küçültüyordu.
   */
  const gesture = useRef({ maxPointers: 0, moved: false, startedAt: 0 });

  const close = useCallback(() => onClose(), [onClose]);
  useHistoryLayer(open, close, id);

  useEffect(() => {
    if (!open) return;
    setState(IDENTITY);
    pointers.current.clear();
    pinchStart.current = null;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close]);

  if (!open) return null;

  /** Kutunun merkezine göre konum: yakınlaştırma odağı böyle hesaplanıyor. */
  function toLocal(event: { clientX: number; clientY: number }): Point {
    const box = surface.current?.getBoundingClientRect();
    if (!box) return { x: 0, y: 0 };
    return {
      x: event.clientX - (box.left + box.width / 2),
      y: event.clientY - (box.top + box.height / 2),
    };
  }

  function viewSize() {
    const box = surface.current?.getBoundingClientRect();
    return { width: box?.width ?? 0, height: box?.height ?? 0 };
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    (event.target as Element).setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, toLocal(event));

    if (pointers.current.size === 1) {
      gesture.current = { maxPointers: 1, moved: false, startedAt: Date.now() };
    } else {
      gesture.current.maxPointers = Math.max(
        gesture.current.maxPointers,
        pointers.current.size,
      );
    }

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = { gap: distance(a, b), scale: state.scale };
    }
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;

    const current = toLocal(event);
    pointers.current.set(event.pointerId, current);

    // Birkaç pikselden fazla oynadıysa bu bir dokunuş değil, harekettir.
    if (Math.hypot(current.x - previous.x, current.y - previous.y) > 4) {
      gesture.current.moved = true;
    }

    if (pointers.current.size >= 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      const gap = distance(a, b);
      if (pinchStart.current.gap > 0) {
        const next = clampScale(
          (pinchStart.current.scale * gap) / pinchStart.current.gap,
        );
        setState((old) => zoomAt(old, midpoint(a, b), next, viewSize()));
      }
      return;
    }

    // Tek parmak: yalnız yakınlaştırılmışken kaydır. Ölçek 1'ken hareketi
    // tarayıcıya bırakmak yerine hiçbir şey yapmıyoruz — sayfa zaten kilitli.
    if (isZoomed(state)) {
      setState((old) =>
        pan(old, current.x - previous.x, current.y - previous.y, viewSize()),
      );
    }
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size > 0) return;

    const now = Date.now();
    const tap =
      gesture.current.maxPointers === 1 &&
      !gesture.current.moved &&
      now - gesture.current.startedAt < 300;

    if (!tap) {
      // Büyütme hareketinden sonra gelen dokunuş çift sayılmasın.
      lastTap.current = 0;
      return;
    }

    // Çift dokunuş: 300 ms içinde ikinci tek parmak dokunuşu.
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      const focal = toLocal(event);
      setState((old) =>
        zoomAt(old, focal, doubleTapScale(old.scale), viewSize()),
      );
      return;
    }
    lastTap.current = now;
  }

  const zoomed = isZoomed(state);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={name}
    >
      <div className="flex min-h-touch items-center justify-between px-4 pt-[env(safe-area-inset-top)]">
        <span className="truncate text-subheadline text-white/80">{name}</span>
        <button
          type="button"
          onClick={close}
          aria-label="Kapat"
          className="-mr-2 h-touch w-touch text-body text-white active:opacity-60"
        >
          ✕
        </button>
      </div>

      <div
        ref={surface}
        data-testid="zoom-yuzeyi"
        // Hareketi tümüyle biz ele alıyoruz; tarayıcı kaydırma/yakınlaştırma
        // yapmasın.
        style={{ touchAction: "none" }}
        className="flex flex-1 items-center justify-center overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={name}
          data-testid="zoom-gorsel"
          draggable={false}
          style={{
            transform: toTransform(state),
            transition: zoomed ? "none" : "transform 200ms cubic-bezier(0.2,0.8,0.2,1)",
          }}
          className="max-h-full max-w-full select-none object-contain"
        />
      </div>

      <p className="pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2 text-center text-caption text-white/60">
        {zoomed ? "Kaydırarak gez · çift dokun küçült" : "İki parmakla ya da çift dokunarak büyüt"}
      </p>
    </div>
  );
}
