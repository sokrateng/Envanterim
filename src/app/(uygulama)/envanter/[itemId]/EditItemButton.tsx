"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Sheet } from "@/components/Sheet";
import { useCloseAndRefresh } from "@/lib/history-layer";
import { useFill } from "./fill-context";
import { FormError, SubmitButton } from "@/components/form";
import {
  ItemFields,
  collectCustomFields,
  type CategoryOption,
  type ItemDefaults,
  type VendorOption,
} from "@/components/ItemFields";

export function EditItemButton({
  itemId,
  categories,
  vendors,
  defaults,
}: {
  itemId: string;
  categories: CategoryOption[];
  vendors: VendorOption[];
  defaults: ItemDefaults;
}) {
  const closeAndRefresh = useCloseAndRefresh();
  const pathname = usePathname();
  const params = useSearchParams();
  const { prefill, setPrefill } = useFill();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Faturadan alan gelince panel kendiliğinden açılır; kullanıcı gördüğü
  // değerleri onaylayıp kaydeder.
  useEffect(() => {
    if (prefill) setOpen(true);
  }, [prefill]);

  // Listeden "Düzenle" kısayoluyla gelindiyse panel açık başlasın.
  //
  // Bayrak adresten hemen siliniyor (yenilemede panel tekrar açılmasın) ama
  // `router.replace` ile değil: panel açılırken geçmişe kendi kaydını
  // bırakıyor ve replace onunla yarışıyor (TUZAKLAR #60). Doğrudan
  // `replaceState` eşzamanlı ve yeni kayıt açmıyor. Bir kez çalışsın diye
  // bayrak ref'te: sonraki çizimlerde panel kendiliğinden açılmasın.
  const shortcutHandled = useRef(false);
  useEffect(() => {
    if (shortcutHandled.current) return;
    if (params.get("duzenle") !== "1") return;
    shortcutHandled.current = true;
    window.history.replaceState(window.history.state, "", pathname);
    setOpen(true);
  }, [params, pathname]);

  function close() {
    setOpen(false);
    setPrefill(null);
  }

  const values = prefill ? { ...defaults, ...prefill } : defaults;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "");

    const response = await fetch(`/api/ekipman/${itemId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: text("name"),
        categoryId: text("categoryId"),
        sellerId: text("sellerId"),
        sellerName: text("sellerName"),
        brand: text("brand"),
        model: text("model"),
        serialNo: text("serialNo"),
        place: text("place"),
        purchaseDate: text("purchaseDate"),
        purchasePrice: text("purchasePrice"),
        currency: text("currency") || "TRY",
        warrantyEndDate: text("warrantyEndDate"),
        status: text("status") || "IN_USE",
        customFields: collectCustomFields(form),
      }),
    });

    setPending(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.hata ?? "Ekipman güncellenemedi");
      return;
    }

    closeAndRefresh(close);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-touch px-2 text-body text-blue active:opacity-60"
      >
        Düzenle
      </button>

      <Sheet
        open={open}
        onClose={close}
        title={prefill ? "Faturadan gelenler" : "Ekipmanı düzenle"}
        guardUnsaved
      >
        {prefill ? (
          <p className="pt-2 text-footnote text-muted">
            Alanlar faturadan okundu; hiçbiri kaydedilmedi. Kontrol edip
            kaydedince geçerli olur.
          </p>
        ) : null}
        <form onSubmit={onSubmit} className="max-h-[70dvh] overflow-y-auto pb-2">
          {/* Girdiler kontrolsüz: faturadan gelen değerler ancak yeniden
              bağlanınca görünür, o yüzden anahtar değişiyor. */}
          <ItemFields
            key={prefill ? "faturadan" : "normal"}
            categories={categories}
            vendors={vendors}
            defaults={values}
          />
          <FormError message={error} />
          <SubmitButton pending={pending}>Kaydet</SubmitButton>
        </form>
      </Sheet>
    </>
  );
}
