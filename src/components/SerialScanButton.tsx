"use client";

import { useState } from "react";
import { CodeCamera } from "@/components/CodeCamera";
import { ScanIcon } from "@/components/ScanIcon";
import { Sheet } from "@/components/Sheet";
import { serialFromScan } from "@/lib/scan";

/**
 * Seri numarasını cihazın üstündeki barkoddan okur.
 *
 * Kamera yalnız panel açıkken kuruluyor: kapatınca bileşen sökülüyor, akış da
 * onunla duruyor. Okunan metnin seri no sayılıp sayılamayacağına saf modül
 * karar veriyor — kendi QR etiketimizi okutan kullanıcının alanına ürün
 * adresi yazılmıyor.
 */
export function SerialScanButton({ onRead }: { onRead: (serial: string) => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setNote(null);
          setOpen(true);
        }}
        aria-label="Seri numarasını barkoddan oku"
        className="grid h-touch w-touch shrink-0 place-items-center rounded-card border border-separator bg-surface text-blue active:opacity-60"
      >
        <ScanIcon />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Barkodu okut">
        <div className="pb-2">
          <CodeCamera
            onCode={(text) => {
              const sonuc = serialFromScan(text);
              if (!sonuc.ok) {
                setNote(sonuc.message);
                // Okuma sürsün: kullanıcı doğru barkodu çerçeveye alabilir.
                return false;
              }
              onRead(sonuc.serial);
              setOpen(false);
              return true;
            }}
            status={note}
            onError={setNote}
          />
          <p className="pt-3 text-footnote text-muted">
            Cihazın üstündeki barkodu çerçeveye al. Okunan kod seri no alanına
            yazılır; kaydetmeden önce kontrol edersin.
          </p>
        </div>
      </Sheet>
    </>
  );
}
