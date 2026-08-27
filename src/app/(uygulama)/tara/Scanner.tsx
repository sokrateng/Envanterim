"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { CodeCamera } from "@/components/CodeCamera";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { readScan, scanSummary, type ScanTarget } from "@/lib/scan";

/**
 * Kamerayla QR/barkod okuma ekranı.
 *
 * Kod çözüldükten sonra nereye gidileceğine sunucu karar veriyor: kameranın
 * gördüğü metin yetki değil, ipucu. Görüntü ve çözümleme `CodeCamera`'da —
 * aynı okuyucu seri no alanında da kullanılıyor.
 */
export function Scanner() {
  const router = useRouter();
  /** Elle yazarken kamera araya girip başka bir ürüne atlamasın. */
  const [typing, setTyping] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  /** Kayıtlı ekipmana denk gelmeyen barkod; "ekleyeyim mi" diye soruyoruz. */
  const [unknownCode, setUnknownCode] = useState<string | null>(null);

  /** Çözülen kodu sunucuya sorar ve yönlendirir. */
  const resolve = useCallback(
    async (raw: string) => {
      const target = readScan(raw);
      if (!target) return false;

      setNote(scanSummary(target));

      const response = await fetch("/api/tara", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kod: raw }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload.hata ?? "Kod okunamadı");
        setNote(null);
        return true;
      }

      switch (payload.tur) {
        case "urun":
          router.push(`/envanter/${payload.id}`);
          return true;
        case "paylasim":
          router.push(`/p/${payload.token}`);
          return true;
        case "arama":
          // Birden çok eşleşme varsa liste doğru cevap; hiç yoksa liste boş
          // bir ekran demek — kullanıcının elindeki cihaz orada yok.
          if (payload.bulunan === 0) {
            setNote(null);
            setUnknownCode(payload.q);
            return true;
          }
          router.push(`/envanter?q=${encodeURIComponent(payload.q)}`);
          return true;
        default:
          setError(notFoundText(target));
          setNote(null);
          return true;
      }
    },
    [router],
  );

  async function submitManual(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const kod = manual.trim();
    if (!kod) return;
    if (!(await resolve(kod))) setError("Kod okunamadı");
  }

  function pauseForTyping(value: string, focused: boolean) {
    setTyping(focused || value.trim() !== "");
  }

  return (
    <div className="px-4 pt-4">
      <CodeCamera
        onCode={resolve}
        paused={typing}
        status={
          error ??
          note ??
          (typing ? "Elle yazarken tarama duraklatıldı" : null)
        }
        onError={setError}
      />

      <p className="px-1 pt-3 text-footnote text-muted">
        Etiketi ya da cihazın üstündeki barkodu çerçeveye al. Kendi QR
        etiketimiz doğrudan ürünü açar; barkod seri numarasında aranır.
      </p>

      {error ? (
        <p role="alert" className="px-1 pt-2 text-footnote text-red">
          {error}
        </p>
      ) : null}

      <ConfirmDialog
        open={unknownCode !== null}
        title="Ekipman bulunamadı"
        message={`${unknownCode} barkoduna kayıtlı ekipman yok. Yeni ekipman olarak eklemek ister misin?`}
        tone="blue"
        primary={{
          label: "Ekipman ekle",
          onSelect: () =>
            router.push(
              `/envanter?yeni=1&seri=${encodeURIComponent(unknownCode ?? "")}`,
            ),
        }}
        confirmLabel="Tekrar tara"
        cancelLabel="Vazgeç"
        onConfirm={() => setUnknownCode(null)}
        onCancel={() => {
          setUnknownCode(null);
          router.push("/envanter");
        }}
      />

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

function notFoundText(target: ScanTarget): string {
  if (target.kind === "item") return "Bu etiket senin envanterinde yok.";
  if (target.kind === "search") return `"${target.query}" ile eşleşen ürün yok.`;
  return "Bu kod Envanterim etiketi değil.";
}
