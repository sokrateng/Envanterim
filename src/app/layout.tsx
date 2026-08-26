import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Envanterim",
  description: "Ev ve iş yerindeki ekipmanların envanteri",
  manifest: "/manifest.webmanifest",
  applicationName: "Envanterim",
  appleWebApp: {
    capable: true,
    title: "Envanterim",
    // "default" durum çubuğunu açık bırakır; koyu temada da okunur kalıyor.
    statusBarStyle: "default",
  },
  icons: {
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  formatDetection: {
    // iOS seri numarasını telefon numarası sanıp bağlantıya çeviriyor.
    telephone: false,
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
