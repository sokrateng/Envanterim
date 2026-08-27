import Link from "next/link";
import { EnvanterLink } from "@/components/EnvanterLink";
import { TITLE_BOX } from "@/lib/typography";
import { Children, Fragment, type ReactNode } from "react";

/**
 * iOS "Inset Grouped" liste deseni ve temel kabuk (docs/TASARIM.md).
 * Hiçbiri hover'a bağlı değil; basılı hissi active:scale ile verilir.
 */

export function Screen({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[430px] pb-28">{children}</div>;
}

/** Başlıktaki geri bağlantısının biçimi; iki bağlantı da aynı görünüyor. */
const BACK_LINK =
  "-ml-1 inline-flex h-touch items-center gap-1 text-body text-blue active:opacity-60";

export function ScreenHeader({
  title,
  action,
  back,
  leading,
  titleClassName = "text-title tracking-tight",
  fixedTitle = false,
}: {
  title: string;
  action?: ReactNode;
  back?: {
    href: string;
    label: string;
    /**
     * Envanter listesine dönerken kullanıcının bıraktığı süzme korunuyor.
     * Düz bağlantı sorguyu baştan yazıyordu (TUZAKLAR #75).
     */
    keepFilters?: boolean;
  };
  /** Başlığın solundaki görsel (ekipman fotoğrafı). */
  leading?: ReactNode;
  /** Uzun adlarda küçülen punto; src/lib/typography.ts'ten geliyor. */
  titleClassName?: string;
  /** Ad alanı sabit yükseklikte: uzun ad sayfayı aşağı itmesin. */
  fixedTitle?: boolean;
}) {
  return (
    <header className="px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
      {back ? (
        back.keepFilters ? (
          <EnvanterLink className={BACK_LINK}>
            <span aria-hidden>‹</span>
            {back.label}
          </EnvanterLink>
        ) : (
          <Link href={back.href} className={BACK_LINK}>
            <span aria-hidden>‹</span>
            {back.label}
          </Link>
        )
      ) : null}
      <div className="flex items-end justify-between gap-3">
        <div
          className={`flex min-w-0 flex-1 items-center gap-3 ${
            fixedTitle ? TITLE_BOX : ""
          }`}
        >
          {leading ? <div className="shrink-0">{leading}</div> : null}
          <h1 className={`min-w-0 break-words ${titleClassName}`}>{title}</h1>
        </div>
        {action}
      </div>
    </header>
  );
}

export function Group({
  title,
  footer,
  children,
}: {
  title?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-6">
      {title ? (
        <h2 className="px-8 pb-2 text-footnote uppercase text-muted">{title}</h2>
      ) : null}
      <div className="mx-4 overflow-hidden rounded-card bg-surface">
        {children}
      </div>
      {footer ? (
        <p className="px-8 pt-2 text-footnote text-muted">{footer}</p>
      ) : null}
    </section>
  );
}

/**
 * Satır listesi. Yatay boşluk satırın kendi içinde: kaydırma jestli satır
 * kenardan kenara olmalı, yoksa altındaki işlem paneli boşluktan sızıyor
 * (TUZAKLAR #63).
 *
 * Ayraç iOS'ta kartın soluna kadar gitmez, metnin hizasından başlar. Çizgi
 * satırların arasında gerçek bir öğe: satırın kendi kenarlığı olsaydı
 * kaydırma jestinde satırla birlikte kayardı, kardeş seçicili bir pseudo-öğe
 * ise girintiyi görünmez bir yere saklardı — burada girinti okunur olmalı.
 */
export function Rows({
  children,
  divider = "text",
}: {
  children: ReactNode;
  /** Ayracın başladığı yer: metin hizası (16px) ya da görselin sağı (80px). */
  divider?: "text" | "leading";
}) {
  // Koşullu satırlar null dönüyor; toArray onları eleyince ayraç da çıkmıyor.
  const rows = Children.toArray(children);
  const inset = divider === "leading" ? "ml-20" : "ml-4";

  return (
    <div>
      {rows.map((row, index) => (
        <Fragment key={index}>
          {index > 0 ? (
            <div aria-hidden className={`h-px bg-separator ${inset}`} />
          ) : null}
          {row}
        </Fragment>
      ))}
    </div>
  );
}

export function Row({
  href,
  title,
  subtitle,
  trailing,
  value,
  badge,
  badgesBelow = false,
  leading,
}: {
  href?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  /**
   * Değer satırı: "Marka → Apple". Gezinme satırından farklı okunuyor —
   * ağırlık başlıkta değil değerde, çünkü kullanıcının aradığı şey değer.
   * `trailing` ise gezinme satırının yanındaki ikincil bilgi (sayı, tarih).
   */
  value?: ReactNode;
  badge?: ReactNode;
  /** Rozetler adın yanına sığmıyorsa alt satıra alınır — ad kırpılmasın. */
  badgesBelow?: boolean;
  /**
   * Satırın solundaki görsel. Bağlantının **dışında** duruyor: içinde
   * olsaydı üstündeki düğme geçersiz biçimlendirme olur, dokunuş da satırı
   * açardı (TUZAKLAR #64).
   */
  leading?: ReactNode;
}) {
  const body = (
    <div className="flex min-h-touch items-center gap-3 py-2.5 pr-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={
              value ? "shrink-0 text-subheadline text-muted" : "truncate text-headline"
            }
          >
            {title}
          </span>
          {value ? (
            <span className="min-w-0 flex-1 break-words text-right text-body">
              {value}
            </span>
          ) : null}
          {badgesBelow ? null : badge}
        </div>
        {subtitle ? (
          <div className="truncate text-footnote text-muted">{subtitle}</div>
        ) : null}
        {badgesBelow && badge ? (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">{badge}</div>
        ) : null}
      </div>
      {trailing ? (
        <div className="shrink-0 text-subheadline text-muted">{trailing}</div>
      ) : null}
      {href ? (
        <span aria-hidden className="shrink-0 text-muted">
          ›
        </span>
      ) : null}
    </div>
  );

  // Solda görsel varsa aradaki boşluk onun sarmalayıcısından geliyor.
  const inset = leading ? "pl-3" : "pl-4";

  return (
    <div className="flex items-center">
      {leading ? <div className="shrink-0 pl-4">{leading}</div> : null}
      {href ? (
        <Link
          href={href}
          className={`block min-w-0 flex-1 ${inset} active:bg-surface-pressed`}
        >
          {body}
        </Link>
      ) : (
        <div className={`min-w-0 flex-1 ${inset}`}>{body}</div>
      )}
    </div>
  );
}

/**
 * Katlanır bölüm — detay sayfasının "Kayıtlar" kartındaki satırlar.
 *
 * Yedi bölüm alt alta açıkken sayfa metrelerce uzuyordu; oysa çoğu ziyarette
 * yalnız biri gerekiyor. Başlıkta duran sayı hangisinde ne olduğunu açmadan
 * söylüyor — boş bölümde sayı yok, o yüzden sessiz kalıyor.
 *
 * Açılıp kapanmayı `<details>` yapıyor: durum tarayıcıda, JavaScript yok,
 * sunucu bileşeni kalabiliyor. Eylem düğmesi başlıkta değil gövdede —
 * başlıktaki bir düğmeye dokunmak bölümü de açıp kapatırdı.
 */
export function Fold({
  id,
  title,
  count,
  children,
}: {
  /** Bildirimden gelen bağlantının çapası (#zimmet gibi). */
  id?: string;
  title: string;
  /** İçerik sayısı; sıfırsa rozet çizilmiyor. */
  count?: number;
  children: ReactNode;
}) {
  return (
    // `open` özniteliği hiç verilmiyor: açık/kapalı tarayıcının işi. React'e
    // bıraksaydık `router.refresh()` sonrası kullanıcının açtığı bölüm
    // kapanırdı — içerik değiştikçe (zimmet iade edilince gibi) bölüm
    // kendiliğinden katlanıyordu.
    <details id={id} className="group scroll-mt-4">
      <summary className="flex min-h-touch list-none items-center gap-2.5 py-2.5 pl-4 pr-4 active:bg-surface-pressed [&::-webkit-details-marker]:hidden">
        <span className="flex-1 text-headline">{title}</span>
        {count ? (
          <span className="rounded-full bg-fill px-2 py-0.5 text-caption text-ink">
            {count}
          </span>
        ) : null}
        <span
          aria-hidden
          className="text-muted transition-transform duration-200 ease-ios group-open:rotate-90"
        >
          ›
        </span>
      </summary>
      <div className="px-4 pb-3 pt-1">{children}</div>
    </details>
  );
}

/**
 * Liste satırının sağındaki durum bloğu: üstte noktalı durum, altında garanti.
 *
 * Rozet yığını yerine iki satır: rozetler adın altına iniyor ve satırı
 * uzatıyordu, oysa durum taranan bir bilgi — hep aynı yerde, sağda durmalı.
 */
export function StatusMark({
  tone,
  label,
  note,
  noteTone = "muted",
}: {
  tone: "green" | "orange" | "blue" | "muted";
  label: string;
  /** İkinci satır: garanti durumu gibi ikincil bilgi. */
  note?: string;
  noteTone?: "green" | "orange" | "muted";
}) {
  const dots: Record<string, string> = {
    green: "bg-green",
    orange: "bg-orange",
    blue: "bg-blue",
    muted: "bg-separator",
  };
  const notes: Record<string, string> = {
    green: "text-green",
    orange: "text-orange",
    muted: "text-muted",
  };

  return (
    <div className="flex flex-col items-end gap-0.5">
      <div className="flex items-center gap-1.5">
        <span aria-hidden className={`h-[7px] w-[7px] rounded-full ${dots[tone]}`} />
        <span className="text-caption text-muted">{label}</span>
      </div>
      {note ? (
        <span className={`text-caption ${notes[noteTone]}`}>{note}</span>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="px-8 py-12 text-center">
      <p className="text-headline">{title}</p>
      <p className="pt-1 text-subheadline text-muted">{description}</p>
    </div>
  );
}

export function Badge({
  tone = "muted",
  children,
}: {
  tone?: "muted" | "green" | "orange" | "red" | "blue";
  children: ReactNode;
}) {
  const tones: Record<string, string> = {
    muted: "bg-separator/40 text-muted",
    green: "bg-green/15 text-green",
    orange: "bg-orange/15 text-orange",
    red: "bg-red/15 text-red",
    blue: "bg-blue/15 text-blue",
  };
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-caption ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
