"use client";

export function PrintButton({ children = "Yazdır" }: { children?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      // Yazdırma çıktısında düğme görünmesin.
      className="min-h-touch rounded-card bg-blue px-4 text-headline text-white transition active:scale-95 print:hidden"
    >
      {children}
    </button>
  );
}
