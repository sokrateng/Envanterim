"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { readScan, scanSummary, type ScanTarget } from "@/lib/scan";

/**
 * Kamerayla QR/barkod okuma.
 *
 * `BarcodeDetector` iOS Safari'de yok (docs/URUN.md), o yüzden zxing-wasm.
 * Modül ve wasm dosyası (~1 MB) yalnız bu ekran açılınca indiriliyor;
 * uygulamanın kalanı bu yükü taşımıyor.
 *
 * Kod çözüldükten sonra nereye gidileceğine sunucu karar veriyor: kameranın
 * gördüğü metin yetki değil, ipucu.
 */

type Reader = (input: ImageData) => Promise<Array<{ text: string }>>;

/** Kare başına iş: 640 piksele indirilmiş görüntü hem hızlı hem yeterli. */
const MAX_EDGE = 640;
const INTERVAL_MS = 250;

async function loadReader(): Promise<Reader> {
  const { prepareZXingModule, readBarcodes } = await import("zxing-wasm/reader");

  // Varsayılan locateFile jsDelivr'a gidiyor; kendi dosyamızı veriyoruz.
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) =>
        path.endsWith(".wasm") ? "/zxing/zxing_reader.wasm" : `${prefix}${path}`,
    },
  });

  return (input) =>
    readBarcodes(input, {
      formats: ["QRCode", "EAN-13", "EAN-8", "Code128", "Code39", "ITF", "DataMatrix"],
      // Karede kod yoksa hızlı vazgeçsin: saniyede birkaç kare deniyoruz.
      tryHarder: false,
      maxNumberOfSymbols: 1,
    }) as Promise<Array<{ text: string }>>;
}

type Phase = "starting" | "scanning" | "resolving" | "error";

export function Scanner() {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const stopped = useRef(false);
  /** Elle yazarken kamera araya girip başka bir ürüne atlamasın. */
  const paused = useRef(false);

  const [phase, setPhase] = useState<Phase>("starting");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [typing, setTyping] = useState(false);

  const stopCamera = useCallback(() => {
    stopped.current = true;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }, []);

  /** Çözülen kodu sunucuya sorar ve yönlendirir. */
  const resolve = useCallback(
    async (raw: string) => {
      const target = readScan(raw);
      if (!target) return false;

      setPhase("resolving");
      setNote(scanSummary(target));

      const response = await fetch("/api/tara", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kod: raw }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload.hata ?? "Kod okunamadı");
        setPhase("error");
        return true;
      }

      switch (payload.tur) {
        case "urun":
          stopCamera();
          router.push(`/envanter/${payload.id}`);
          return true;
        case "paylasim":
          stopCamera();
          router.push(`/p/${payload.token}`);
          return true;
        case "arama":
          stopCamera();
          router.push(`/envanter?q=${encodeURIComponent(payload.q)}`);
          return true;
        default:
          setError(notFoundText(target));
          setPhase("error");
          return true;
      }
    },
    [router, stopCamera],
  );

  useEffect(() => {
    stopped.current = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function start() {
      let read: Reader;
      try {
        read = await loadReader();
      } catch {
        setError("Kod okuyucu yüklenemedi. Sayfayı yenile.");
        setPhase("error");
        return;
      }

      try {
        stream.current = await navigator.mediaDevices.getUserMedia({
          // Arka kamera: etiket cihazın üstünde, kullanıcının yüzünde değil.
          video: { facingMode: { ideal: "environment" } },
        });
      } catch (cause) {
        setError(cameraError(cause));
        setPhase("error");
        return;
      }

      if (stopped.current) {
        stream.current.getTracks().forEach((track) => track.stop());
        return;
      }

      const element = video.current;
      if (!element) return;
      element.srcObject = stream.current;
      await element.play().catch(() => undefined);
      setPhase("scanning");

      // Kareler sırayla işleniyor: üst üste binen çözümleme telefonu ısıtır
      // ve kuyruğu büyütür, okumayı hızlandırmaz.
      const tick = async () => {
        if (stopped.current) return;

        const frame = paused.current ? null : grabFrame(element, canvas);
        if (frame) {
          try {
            const [found] = await read(frame);
            if (found?.text && !stopped.current) {
              const handled = await resolve(found.text);
              if (handled) return;
            }
          } catch {
            // Tek karenin çözümlenememesi taramayı bitirmez.
          }
        }

        if (!stopped.current) timer = setTimeout(tick, INTERVAL_MS);
      };

      timer = setTimeout(tick, INTERVAL_MS);
    }

    void start();

    return () => {
      if (timer) clearTimeout(timer);
      stopCamera();
    };
  }, [resolve, stopCamera]);

  function pauseForTyping(value: string, focused: boolean) {
    const active = focused || value.trim() !== "";
    paused.current = active;
    setTyping(active);
  }

  async function submitManual(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const kod = manual.trim();
    if (!kod) return;
    if (!(await resolve(kod))) setError("Kod okunamadı");
  }

  return (
    <div className="px-4 pt-4">
      <div className="relative aspect-[3/4] overflow-hidden rounded-card bg-black">
        <video
          ref={video}
          playsInline
          muted
          autoPlay
          aria-label="Kamera görüntüsü"
          className="h-full w-full object-cover"
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="h-48 w-48 rounded-[28px] border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        </div>
        {typing && phase === "scanning" ? (
          <p
            role="status"
            className="absolute inset-x-0 bottom-0 bg-black/60 px-4 py-3 text-center text-footnote text-white"
          >
            Elle yazarken tarama duraklatıldı
          </p>
        ) : null}
        {phase !== "scanning" ? (
          <p
            role="status"
            className="absolute inset-x-0 bottom-0 bg-black/60 px-4 py-3 text-center text-footnote text-white"
          >
            {phase === "starting"
              ? "Kamera açılıyor…"
              : phase === "resolving"
                ? (note ?? "Kod okundu")
                : (error ?? "Kamera açılamadı")}
          </p>
        ) : null}
      </div>

      <p className="px-1 pt-3 text-footnote text-muted">
        Etiketi ya da cihazın üstündeki barkodu çerçeveye al. Kendi QR
        etiketimiz doğrudan ürünü açar; barkod seri numarasında aranır.
      </p>

      {error && phase === "error" ? (
        <p role="alert" className="px-1 pt-2 text-footnote text-red">
          {error}
        </p>
      ) : null}

      <form onSubmit={submitManual} className="flex gap-2 pt-4">
        <input
          value={manual}
          onChange={(event) => {
            setManual(event.target.value);
            pauseForTyping(event.target.value, true);
          }}
          onFocus={(event) => pauseForTyping(event.target.value, true)}
          onBlur={(event) => pauseForTyping(event.target.value, false)}
          placeholder="Kodu elle yaz"
          aria-label="Kodu elle yaz"
          autoCapitalize="characters"
          autoCorrect="off"
          className="w-full rounded-card border border-separator bg-surface px-3 py-2.5 text-body outline-none focus:border-blue"
        />
        <button
          type="submit"
          className="min-h-touch shrink-0 rounded-card bg-blue px-4 text-headline text-white transition active:scale-95"
        >
          Ara
        </button>
      </form>
    </div>
  );
}

/** Videodan tek kare; tuval yeniden kullanılıyor, her karede yenisi açılmıyor. */
function grabFrame(
  video: HTMLVideoElement,
  store: React.MutableRefObject<HTMLCanvasElement | null>,
): ImageData | null {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return null;

  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);

  const target = (store.current ??= document.createElement("canvas"));
  if (target.width !== w || target.height !== h) {
    target.width = w;
    target.height = h;
  }

  const context = target.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  context.drawImage(video, 0, 0, w, h);
  return context.getImageData(0, 0, w, h);
}

function notFoundText(target: ScanTarget): string {
  if (target.kind === "item") return "Bu etiket senin envanterinde yok.";
  if (target.kind === "search") return `"${target.query}" ile eşleşen ürün yok.`;
  return "Bu kod Envanterim etiketi değil.";
}

function cameraError(cause: unknown): string {
  const name = (cause as { name?: string })?.name;
  if (name === "NotAllowedError") {
    return "Kamera izni verilmedi. Tarayıcı ayarlarından izin ver, sonra sayfayı yenile.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "Kamera bulunamadı. Kodu aşağıya elle yazabilirsin.";
  }
  // getUserMedia yalnız güvenli kaynakta çalışır; http üzerinden hiç açılmaz.
  if (!window.isSecureContext) {
    return "Kamera yalnız https bağlantıda açılır. Kodu aşağıya elle yazabilirsin.";
  }
  return "Kamera açılamadı. Kodu aşağıya elle yazabilirsin.";
}
