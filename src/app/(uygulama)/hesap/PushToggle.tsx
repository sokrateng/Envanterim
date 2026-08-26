"use client";

import { useEffect, useState } from "react";
import {
  checkSupport,
  currentEndpoint,
  subscribe,
  unsubscribe,
} from "@/lib/push-client";

/**
 * Garanti bildirimi aboneliği. Bu cihaz için açılıp kapanıyor: abonelik
 * cihaz başına, kullanıcı birden çok cihazdan girebiliyor (MIMARI §4).
 */
export function PushToggle({ publicKey }: { publicKey: string }) {
  const [durum, setDurum] = useState<"yukleniyor" | "kapali" | "acik" | "desteklenmiyor">(
    "yukleniyor",
  );
  const [sebep, setSebep] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const support = checkSupport();
    if (!support.supported) {
      setSebep(support.reason);
      setDurum("desteklenmiyor");
      return;
    }
    currentEndpoint()
      .then((endpoint) => setDurum(endpoint ? "acik" : "kapali"))
      .catch(() => setDurum("kapali"));
  }, []);

  async function ac() {
    setBusy(true);
    setSebep(null);
    try {
      await subscribe(publicKey);
      setDurum("acik");
    } catch (error) {
      setSebep(error instanceof Error ? error.message : "Abone olunamadı");
    } finally {
      setBusy(false);
    }
  }

  async function kapat() {
    setBusy(true);
    setSebep(null);
    try {
      await unsubscribe();
      setDurum("kapali");
    } catch {
      setSebep("Abonelik kapatılamadı");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 py-2.5">
      <div className="flex min-h-touch items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="block text-body">Garanti bildirimi</span>
          <span className="block text-footnote text-muted">
            Garanti bitimine 30 ve 7 gün kala bu cihaza uyarı gelir.
          </span>
        </div>
        {durum === "yukleniyor" ? (
          <span className="shrink-0 text-subheadline text-muted">…</span>
        ) : durum === "desteklenmiyor" ? (
          <span className="shrink-0 text-subheadline text-muted">Kapalı</span>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={durum === "acik" ? kapat : ac}
            className={`min-h-touch shrink-0 rounded-card px-4 text-subheadline transition active:scale-95 disabled:opacity-50 ${
              durum === "acik" ? "bg-separator/40 text-ink" : "bg-blue text-white"
            }`}
          >
            {durum === "acik" ? "Kapat" : "Aç"}
          </button>
        )}
      </div>
      {sebep ? (
        <p className="pt-1 text-footnote text-muted" role="status">
          {sebep}
        </p>
      ) : null}
    </div>
  );
}
