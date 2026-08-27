"use client";

import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Uzun basınca değeri panoya kopyalar.
 *
 * Neden kendi jestimiz: iOS'un kendi "seç ve kopyala" menüsü tek tek kelimeleri
 * seçtiriyor, oysa istenen şey satırın **değeri** — üstelik başlıkta üç ayrı
 * alanı ("marka model ad") tek dizgi hâlinde birleştirip vermek seçimle
 * mümkün değil.
 *
 * **Kopyalama parmağı kaldırınca yapılıyor, zamanlayıcıda değil.** Safari pano
 * yazmasını kullanıcı hareketine bağlıyor; `setTimeout` içinden çağrılan
 * `clipboard.writeText` hareketin dışında kalıp sessizce reddediliyor.
 * `pointerup` ise hareketin kendisi: basılı tutma süresini orada ölçüp orada
 * yazıyoruz.
 *
 * Metin seçimi ve iOS dokunma menüsü kapalı: açık kalsaydı uzun basış bizim
 * yerimize sistem menüsünü açardı.
 *
 * Dokunmatikte yalnız uzun basış kopyalıyor — kısa dokunuş bir şey yapmıyor,
 * yoksa satıra değen parmak farkında olmadan panoyu değiştirirdi. Fare ve
 * klavyede tek tık/Enter kopyalıyor: orada uzun basış diye bir şey yok.
 *
 * Geri bildirim ekranın altında beliren bir şerit. Satırın içine yazılsaydı
 * satır bir buçuk saniyeliğine uzayıp altındaki her şeyi aşağı iterdi; üstelik
 * kopyalanan alan ekranın neresinde olursa olsun haber hep aynı yerde çıkıyor.
 * Şerit `body`ye taşınıyor: `transform`lu bir atanın içinde `fixed` o ataya
 * hapsoluyor (TUZAKLAR #68).
 */

/** Kaç ms basılı tutunca kopyalanıyor. iOS'un kendi eşiği de bu civarda. */
const HOLD_MS = 450;

/** Bu kadar kayan parmak basış değil, kaydırmadır. */
const MOVE_TOLERANCE = 10;

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // İzin yok ya da güvenli bağlam değil; aşağıdaki eski yola düşüyoruz.
  }

  try {
    // `http` üzerinde `navigator.clipboard` yok; eski yol hâlâ çalışıyor.
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function CopyOnHold({
  value,
  label,
  children,
  className = "",
}: {
  /** Panoya yazılacak dizgi. */
  value: string;
  /** Neyin kopyalandığı: erişilebilir ad ve geri bildirim metni buradan. */
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  const press = useRef<{ at: number; x: number; y: number; touch: boolean } | null>(
    null,
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function show(next: "done" | "error") {
    setState(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 1600);
  }

  async function run() {
    show((await copyText(value)) ? "done" : "error");
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${label}: ${value} — kopyalamak için basılı tut`}
      onPointerDown={(event) => {
        press.current = {
          at: Date.now(),
          x: event.clientX,
          y: event.clientY,
          touch: event.pointerType !== "mouse",
        };
      }}
      onPointerMove={(event) => {
        const start = press.current;
        if (!start) return;
        if (
          Math.abs(event.clientX - start.x) > MOVE_TOLERANCE ||
          Math.abs(event.clientY - start.y) > MOVE_TOLERANCE
        ) {
          press.current = null;
        }
      }}
      onPointerUp={() => {
        const start = press.current;
        press.current = null;
        if (!start) return;
        // Farede tek tık yeter; dokunmatikte basılı tutmak gerekiyor.
        if (!start.touch || Date.now() - start.at >= HOLD_MS) void run();
      }}
      onPointerCancel={() => {
        press.current = null;
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          void run();
        }
      }}
      // Seçim ve iOS dokunma menüsü kapalı: uzun basış bize kalsın.
      className={`select-none [-webkit-touch-callout:none] ${className}`}
    >
      {children}
      {state === "idle" || typeof document === "undefined"
        ? null
        : createPortal(
            <div
              role="status"
              // Sekme çubuğunun üstünde: altında kalsa görünmezdi.
              className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+96px)] z-50 flex justify-center px-4"
            >
              <span
                className={`rounded-card px-3 py-2 text-footnote text-white ${
                  state === "done" ? "bg-black/80" : "bg-red"
                }`}
              >
                {state === "done"
                  ? `${label} kopyalandı`
                  : "Kopyalanamadı — panoya erişilemiyor"}
              </span>
            </div>,
            document.body,
          )}
    </div>
  );
}
