"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Kamerayla kod okuma — yalnız görüntü ve çözümleme; kodun ne anlama geldiğine
 * kullanan karar veriyor.
 *
 * `BarcodeDetector` iOS Safari'de yok (docs/URUN.md), o yüzden zxing-wasm.
 * Modül ve wasm dosyası (~1 MB) yalnız bu bileşen ekrana gelince indiriliyor;
 * uygulamanın kalanı bu yükü taşımıyor.
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

export function CodeCamera({
  onCode,
  paused = false,
  status = null,
  onError,
}: {
  /** Çözülen metin. `true` dönerse tarama durur; `false` ise devam eder. */
  onCode: (text: string) => boolean | Promise<boolean>;
  /** Elle yazarken kamera araya girip başka bir sonuca atlamasın. */
  paused?: boolean;
  /** Kullanan bileşenin göstermek istediği durum metni; kendi metnini ezer. */
  status?: string | null;
  onError?: (message: string) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const stopped = useRef(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // Kare döngüsü yeniden kurulmasın diye işleyici ref'te tutuluyor: her
  // render'da yeni bir fonksiyon gelse de kamera yeniden açılmıyor.
  const handler = useRef(onCode);
  handler.current = onCode;
  const errorHandler = useRef(onError);
  errorHandler.current = onError;

  const [phase, setPhase] = useState<"starting" | "scanning" | "error">("starting");
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    stopped.current = true;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }, []);

  useEffect(() => {
    stopped.current = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function start() {
      let read: Reader;
      try {
        read = await loadReader();
      } catch {
        fail("Kod okuyucu yüklenemedi. Sayfayı yenile.");
        return;
      }

      try {
        stream.current = await navigator.mediaDevices.getUserMedia({
          // Arka kamera: etiket cihazın üstünde, kullanıcının yüzünde değil.
          video: { facingMode: { ideal: "environment" } },
        });
      } catch (cause) {
        fail(cameraErrorText(cause));
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

        const frame = pausedRef.current ? null : grabFrame(element, canvas);
        if (frame) {
          try {
            const [found] = await read(frame);
            if (found?.text && !stopped.current) {
              if (await handler.current(found.text)) return;
            }
          } catch {
            // Tek karenin çözümlenememesi taramayı bitirmez.
          }
        }

        if (!stopped.current) timer = setTimeout(tick, INTERVAL_MS);
      };

      timer = setTimeout(tick, INTERVAL_MS);
    }

    function fail(message: string) {
      setCameraError(message);
      setPhase("error");
      errorHandler.current?.(message);
    }

    void start();

    return () => {
      if (timer) clearTimeout(timer);
      stopCamera();
    };
  }, [stopCamera]);

  const overlay =
    status ??
    (phase === "starting"
      ? "Kamera açılıyor…"
      : phase === "error"
        ? (cameraError ?? "Kamera açılamadı")
        : null);

  return (
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
      {overlay ? (
        <p
          role="status"
          className="absolute inset-x-0 bottom-0 bg-black/60 px-4 py-3 text-center text-footnote text-white"
        >
          {overlay}
        </p>
      ) : null}
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

export function cameraErrorText(cause: unknown): string {
  const name = (cause as { name?: string })?.name;
  if (name === "NotAllowedError") {
    return "Kamera izni verilmedi. Tarayıcı ayarlarından izin ver, sonra sayfayı yenile.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "Kamera bulunamadı. Kodu elle yazabilirsin.";
  }
  // getUserMedia yalnız güvenli kaynakta çalışır; http üzerinden hiç açılmaz.
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Kamera yalnız https bağlantıda açılır. Kodu elle yazabilirsin.";
  }
  return "Kamera açılamadı. Kodu elle yazabilirsin.";
}
