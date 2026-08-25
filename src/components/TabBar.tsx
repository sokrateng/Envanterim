"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Alt sekme çubuğu — güvenli alan hesaba katılmazsa ana ekran göstergesinin
 * altında kalır (docs/TASARIM.md). İkonlar SF Symbols'a yakın duran çizgi
 * ikonlar; emoji iOS'ta sekme çubuğunda yabancı duruyor.
 */
const TABS = [
  {
    href: "/lokasyonlar",
    label: "Lokasyonlar",
    path: "M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5M10 20v-5.5h4V20",
  },
  {
    href: "/envanter",
    label: "Envanter",
    path: "M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9ZM3.5 7.5 12 12m0 0 8.5-4.5M12 12v9",
  },
  {
    href: "/hesap",
    label: "Hesap",
    path: "M12 11.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6",
  },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-separator bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex w-full max-w-[430px]">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-touch flex-col items-center justify-center gap-1 py-1.5 active:opacity-60 ${
                  active ? "text-blue" : "text-muted"
                }`}
              >
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className="h-[22px] w-[22px]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={tab.path} />
                </svg>
                <span className="text-caption">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
