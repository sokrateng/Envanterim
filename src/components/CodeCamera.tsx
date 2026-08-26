"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Kamerayla kod okuma — yalnız görüntü ve çözümleme; kodun ne anlama geldiğine
 * kullanan karar veriyor.
 *
 * `BarcodeDetector` iOS Safari'de yok (docs/URUN.md), o yüzden zxing-wasm.
 * Modül ve wasm dosyası (~1 MB) yalnız bu bileşen ekrana gelince indiriliyor.
 *
 * Gerçek ürün etiketlerini okuyabilmek için üç şey belirleyici (TUZAKLAR #58):
 * çözünürlük, çerçeveleme ve odak. Varsayılan `getUserMedia` 640×480 veriyor;
 * o karede küçük bir etiket birkaç piksele düşüyor ve hiçbir okuyucu çözemiyor.
 * Bu yüzden yüksek çözünürlük isteniyor, çözümleme tüm kare yerine kullanıcının
 * gördüğü pencereye kırpılıyor ve yakınlaştırma pencereyi daraltıyor —
 * kırpılan alan küçüldükçe kodun piksel yoğunluğu artıyor.
 */

type ReadOptions = { formats: string[]; tryHarder: boolean };
type Reader = (
  input: ImageData,
  options: ReadOptions,
) => Promise<Array<{ text: string }>>;

/** Okuma penceresi: kare içindeki oran. Barkodlar geniş, kutu da geniş. */
const WINDOW = { width: 0.86, height: 0.5 };

/** Kırpılmış görüntünün uzun kenarı; altına inmek okumayı bozuyor. */
const ROI_EDGE = 1280;
const FULL_EDGE = 1024;
const INTERVAL_MS = 200;

/** Her tür kod: kullanıcı hangi etiketi okutacağını önceden bilmiyor. */
const FORMATS = ["AllReadable"];

export const ZOOM_STEPS = [1, 1.5, 2, 3, 4] as const;

async function loadReader(): Promise<Reader> {
  const { prepareZXingModule, readBarcodes } = await import("zxing-wasm/reader");

  // Varsayılan locateFile jsDelivr'a gidiyor; kendi dosyamızı veriyoruz.
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) =>
        path.endsWith(".wasm") ? "/zxing/zxing_reader.wasm" : `${prefix}${path}`,
    },
  });

  return (input, options) =>
    readBarcodes(input, {
      formats: options.formats as never,
      // Gerçek etikette eğrilik, parlama ve bulanıklık var; "hızlı vazgeç"
      // yalnız kusursuz üretilmiş görüntülerde yeterliydi.
      tryHarder: options.tryHarder,
      tryRotate: true,
      tryInvert: true,
      tryDownscale: true,
      maxNumberOfSymbols: 1,
    }) as Promise<Array<{ text: string }>>;
}

type TrackCapabilities = MediaTrackCapabilities & {
  torch?: boolean;
  zoom?: { min: number; max: number; step?: number };
};

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
  const track = useRef<MediaStreamTrack | null>(null);
  const stopped = useRef(false);

  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // Kare döngüsü yeniden kurulmasın diye değişenler ref'te: her render'da yeni
  // bir fonksiyon gelse de kamera yeniden açılmıyor.
  const handler = useRef(onCode);
  handler.current = onCode;
  const errorHandler = useRef(onError);
  errorHandler.current = onError;
  const zoomRef = useRef(1);

  const [phase, setPhase] = useState<"starting" | "scanning" | "error">("starting");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [torchOn, setTorchOn] = useState(false);
  const [canTorch, setCanTorch] = useState(false);
  const [nativeZoom, setNativeZoom] = useState<{ min: number; max: number } | null>(
    null,
  );

  const stopCamera = useCallback(() => {
    stopped.current = true;
    stream.current?.getTracks().forEach((item) => item.stop());
    stream.current = null;
    track.current = null;
  }, []);

  /**
   * Yakınlaştırma. Sürücü destekliyorsa gerçek zoom (görüntü keskin kalır),
   * desteklemiyorsa kırpma — iOS Safari `zoom` kısıtını uygulamıyor, orada
   * kırpma tek yol ve zaten çözümlemeye giden görüntüyü büyütüyor.
   */
  const applyZoom = useCallback(
    (value: number) => {
      setZoom(value);
      zoomRef.current = value;

      const current = track.current;
      if (!current || !nativeZoom) return;
      const target = Math.min(
        nativeZoom.max,
        Math.max(nativeZoom.min, nativeZoom.min * value),
      );
      void current
        .applyConstraints({ advanced: [{ zoom: target } as MediaTrackConstraintSet] })
        .catch(() => undefined);
    },
    [nativeZoom],
  );

  const toggleTorch = useCallback(async () => {
    const current = track.current;
    if (!current) return;
    const next = !torchOn;
    try {
      await current.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      });
      setTorchOn(next);
    } catch {
      // Işık açılamıyorsa düğme yanıltmasın.
      setCanTorch(false);
    }
  }, [torchOn]);

  useEffect(() => {
    stopped.current = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let round = 0;

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
          video: {
            // Arka kamera: etiket cihazın üstünde, kullanıcının yüzünde değil.
            facingMode: { ideal: "environment" },
            // Küçük etiketin okunabilmesi için asıl belirleyici bu.
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
          },
        });
      } catch (cause) {
        fail(cameraErrorText(cause));
        return;
      }

      if (stopped.current) {
        stream.current.getTracks().forEach((item) => item.stop());
        return;
      }

      const element = video.current;
      if (!element) return;
      element.srcObject = stream.current;
      await element.play().catch(() => undefined);

      const [first] = stream.current.getVideoTracks();
      track.current = first ?? null;
      const capabilities = (first?.getCapabilities?.() ?? {}) as TrackCapabilities;
      setCanTorch(Boolean(capabilities.torch));
      const zoomRange = capabilities.zoom as
        | { min: number; max: number }
        | undefined;
      if (zoomRange && zoomRange.max > zoomRange.min) setNativeZoom(zoomRange);

      setPhase("scanning");

      // Kareler sırayla işleniyor: üst üste binen çözümleme telefonu ısıtır ve
      // kuyruğu büyütür, okumayı hızlandırmaz.
      const tick = async () => {
        if (stopped.current) return;

        if (!pausedRef.current) {
          // Çoğu turda pencereye kırpılmış, yüksek çözünürlüklü görüntü; arada
          // bir tüm kare, çerçevenin dışında kalan kod da yakalansın diye.
          const fullFrame = round % 3 === 2;
          const frame = fullFrame
            ? grabFrame(element, canvas, { region: null, zoom: 1, maxEdge: FULL_EDGE })
            : grabFrame(element, canvas, {
                region: WINDOW,
                zoom: zoomRef.current,
                maxEdge: ROI_EDGE,
              });
          round += 1;

          if (frame) {
            try {
              const [found] = await read(frame, {
                formats: FORMATS,
                tryHarder: !fullFrame,
              });
              if (found?.text && !stopped.current) {
                if (await handler.current(found.text)) return;
              }
            } catch {
              // Tek karenin çözümlenememesi taramayı bitirmez.
            }
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
    <div>
      <div className="relative aspect-[3/4] overflow-hidden rounded-card bg-black">
        <video
          ref={video}
          playsInline
          muted
          autoPlay
          aria-label="Kamera görüntüsü"
          className="h-full w-full object-cover"
        />

        {/* Okuma penceresi: çözümlemenin baktığı alanla birebir aynı. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
          <div
            className="relative overflow-hidden rounded-[20px] border-2 border-white/85 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
            style={{
              width: `${WINDOW.width * 100}%`,
              height: `${WINDOW.height * 100}%`,
            }}
          >
            {phase === "scanning" && !paused ? (
              <div
                data-tarama-cizgisi
                className="scan-line absolute inset-x-2 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-red shadow-[0_0_8px_2px_rgba(255,59,48,0.65)]"
              />
            ) : null}
          </div>
        </div>

        {canTorch ? (
          <button
            type="button"
            onClick={() => void toggleTorch()}
            aria-pressed={torchOn}
            aria-label={torchOn ? "Işığı kapat" : "Işığı aç"}
            className="absolute right-3 top-3 grid h-touch w-touch place-items-center rounded-full bg-black/55 text-white active:opacity-60"
          >
            <TorchIcon on={torchOn} />
          </button>
        ) : null}

        {overlay ? (
          <p
            role="status"
            className="absolute inset-x-0 bottom-0 bg-black/60 px-4 py-3 text-center text-footnote text-white"
          >
            {overlay}
          </p>
        ) : null}
      </div>

      {/* Yakınlaştırma: küçük etiket çerçeveyi doldurdukça okuma kolaylaşıyor. */}
      {phase === "scanning" ? (
        <div className="pt-3">
          <p id="zoom-label" className="pb-1 text-footnote text-muted">
            Yakınlaştır
          </p>
          <div role="group" aria-labelledby="zoom-label" className="flex gap-1">
            {ZOOM_STEPS.map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => applyZoom(step)}
                aria-pressed={zoom === step}
                aria-label={`${step} kat yakınlaştır`}
                className={`min-h-touch flex-1 rounded-card text-footnote transition active:scale-95 ${
                  zoom === step
                    ? "bg-blue text-white"
                    : "border border-separator bg-surface text-blue"
                }`}
              >
                {step}×
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TorchIcon({ on }: { on: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-[22px] w-[22px]"
      fill={on ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" />
    </svg>
  );
}

/**
 * Videodan tek kare. `region` verilirse ortadaki pencereye kırpılıyor;
 * `zoom` pencereyi daha da daraltıyor. Tuval yeniden kullanılıyor.
 *
 * Kırpılan alan hiçbir zaman büyütülmüyor: yapay büyütme yeni ayrıntı
 * getirmiyor, yalnız çözümlemeyi yavaşlatıyor.
 */
function grabFrame(
  video: HTMLVideoElement,
  store: React.MutableRefObject<HTMLCanvasElement | null>,
  options: {
    region: { width: number; height: number } | null;
    zoom: number;
    maxEdge: number;
  },
): ImageData | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;

  const region = options.region ?? { width: 1, height: 1 };
  const zoom = Math.max(1, options.zoom);
  const sw = Math.max(16, Math.round((vw * region.width) / zoom));
  const sh = Math.max(16, Math.round((vh * region.height) / zoom));
  const sx = Math.round((vw - sw) / 2);
  const sy = Math.round((vh - sh) / 2);

  const scale = Math.min(1, options.maxEdge / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));

  const target = (store.current ??= document.createElement("canvas"));
  if (target.width !== w || target.height !== h) {
    target.width = w;
    target.height = h;
  }

  const context = target.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  context.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
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
