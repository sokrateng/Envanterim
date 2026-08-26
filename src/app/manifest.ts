import type { MetadataRoute } from "next";

/**
 * PWA manifesti. `standalone` ana ekrandan tam ekran açar; iOS'ta sayfa
 * yakınlaştırmasını da kapatır — bu yüzden görsel büyütme kendi
 * görüntüleyicimizde (TUZAKLAR #8, src/components/ImageViewer.tsx).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Envanterim — ekipman envanteri",
    short_name: "Envanterim",
    description:
      "Ev ve iş yerindeki ekipmanların envanteri: garanti, fatura, servis geçmişi",
    lang: "tr",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F2F2F7",
    theme_color: "#F2F2F7",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
