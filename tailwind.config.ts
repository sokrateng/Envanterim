import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // CSS değişkenlerine bağlı; koyu tema otomatik gelir.
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-pressed": "var(--surface-pressed)",
        separator: "var(--separator)",
        ink: "var(--text)",
        muted: "var(--text-secondary)",
        blue: "var(--ios-blue)",
        green: "var(--ios-green)",
        red: "var(--ios-red)",
        orange: "var(--ios-orange)",
      },
      fontSize: {
        // iOS Text Styles karşılıkları (docs/TASARIM.md)
        "large-title": ["34px", { lineHeight: "41px", fontWeight: "700" }],
        title: ["22px", { lineHeight: "28px", fontWeight: "700" }],
        headline: ["17px", { lineHeight: "22px", fontWeight: "600" }],
        body: ["17px", { lineHeight: "22px" }],
        subheadline: ["15px", { lineHeight: "20px" }],
        footnote: ["13px", { lineHeight: "18px" }],
        caption: ["12px", { lineHeight: "16px" }],
      },
      borderRadius: {
        card: "10px",
        sheet: "16px",
      },
      spacing: {
        "safe-top": "env(safe-area-inset-top)",
        "safe-bottom": "env(safe-area-inset-bottom)",
        touch: "44px", // en küçük dokunma hedefi
      },
      transitionTimingFunction: {
        ios: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
    },
  },
  plugins: [],
};
export default config;
