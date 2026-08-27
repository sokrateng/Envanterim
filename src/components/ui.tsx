import Link from "next/link";
import { TITLE_BOX } from "@/lib/typography";
import type { ReactNode } from "react";

/**
 * iOS "Inset Grouped" liste deseni ve temel kabuk (docs/TASARIM.md).
 * Hiçbiri hover'a bağlı değil; basılı hissi active:scale ile verilir.
 */

export function Screen({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[430px] pb-28">{children}</div>;
}

export function ScreenHeader({
  title,
  action,
  back,
  leading,
  titleClassName = "text-large-title tracking-tight",
  fixedTitle = false,
}: {
  title: string;
  action?: ReactNode;
  back?: { href: string; label: string };
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
        <Link
          href={back.href}
          className="-ml-1 inline-flex h-touch items-center gap-1 text-body text-blue active:opacity-60"
        >
          <span aria-hidden>‹</span>
          {back.label}
        </Link>
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

/** Satır ayracı soldan 16px içeriden başlar — iOS deseni. */
/**
 * Satır listesi. Yatay boşluk satırın kendi içinde: kaydırma jestli satır
 * kenardan kenara olmalı, yoksa altındaki işlem paneli boşluktan sızıyor
 * (TUZAKLAR #63).
 */
export function Rows({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-separator">{children}</div>;
}

export function Row({
  href,
  title,
  subtitle,
  trailing,
  badge,
  badgesBelow = false,
  leading,
}: {
  href?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
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
          <span className="truncate text-headline">{title}</span>
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
