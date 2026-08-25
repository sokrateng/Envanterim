import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Envanterim",
  description: "Ev ve iş yerindeki ekipmanların envanteri",
  appleWebApp: {
    capable: true,
    title: "Envanterim",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // viewport-fit=cover olmadan env(safe-area-inset-*) sıfır döner.
  viewportFit: "cover",
  // maximum-scale=1 yazmıyoruz: parmakla yakınlaştırmayı öldürür (TUZAKLAR #8).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
