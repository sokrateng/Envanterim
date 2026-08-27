"use client";

import { useEffect, useRef, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Liste aşağı indikçe uzuyor.
 *
 * "Önceki / Sonraki" telefonda yanlış bir hareket: parmak zaten kaydırıyor,
 * sayfa sonunda durup küçük bir bağlantıya nişan almak gerekiyordu. Artık
 * listenin sonu görününce bir sonraki dilim kendiliğinden geliyor.
 *
 * Kaç dilimin yüklendiği **adres çubuğunda** duruyor (`sayfa=3` = üç dilim) ve
 * satırları yine sunucu çiziyor. Böylece satırın nasıl çizildiği tek yerde
 * kalıyor: istemciye ayrı bir liste bileşeni ve ayrı bir veri ucu yazmak,
 * yetki ve süzme kurallarını ikizlemek demekti. Yenileme, geri tuşu ve
 * paylaşılan bağlantı da kendiliğinden aynı yeri gösteriyor — kaydırma
 * konumunu tarayıcı geri getiriyor.
 *
 * Düğme her zaman çiziliyor, gözlemci de ona basıyor: ekran okuyucu ve
 * IntersectionObserver'ı olmayan tarayıcı için gerçek bir denetim kalıyor.
 */
export function MoreRows({
  page,
  shown,
  total,
  autoPages,
}: {
  /** Kaç dilim yüklendi. */
  page: number;
  /** Ekranda kaç satır var. */
  shown: number;
  total: number;
  /**
   * Kendiliğinden yüklemenin sınırı. Bu dilimden sonra kullanıcı basıyor:
   * beş bin kalemli bir envanterde kaydırmaya devam etmek tarayıcıyı
   * boğardı, oysa aranan şey çoğu zaman süzmekle bulunuyor.
   */
  autoPages: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const button = useRef<HTMLButtonElement>(null);

  const hasMore = shown < total;
  const sorgu = params.toString();

  useEffect(() => {
    if (!hasMore || pending || page >= autoPages) return;
    const node = button.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    // Ekranın biraz altındayken başlıyor: satırlar gelene kadar kullanıcı
    // boşluğa bakmasın.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) node.click();
      },
      { rootMargin: "400px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, pending, page, autoPages]);

  if (!hasMore) {
    return null;
  }

  function load() {
    const query = new URLSearchParams(sorgu);
    query.set("sayfa", String(page + 1));
    // `scroll: false` olmadan liste başa sıçrıyor; kullanıcı zaten aşağıda.
    start(() => router.replace(`${pathname}?${query.toString()}`, { scroll: false }));
  }

  return (
    <div className="px-4 pt-4">
      <button
        ref={button}
        type="button"
        onClick={load}
        disabled={pending}
        aria-label={`Daha fazla ekipman göster — ${shown} / ${total}`}
        className="min-h-touch w-full rounded-card bg-surface text-body text-blue transition active:scale-95 disabled:text-muted"
      >
        {pending ? "Yükleniyor…" : "Daha fazla göster"}
      </button>
      <p aria-hidden className="pt-2 text-center text-footnote text-muted">
        {shown} / {total}
      </p>
    </div>
  );
}
