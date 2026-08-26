"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { ItemDefaults } from "@/components/ItemFields";

/**
 * Faturadan çıkarılan alanları düzenleme formuna taşır.
 *
 * Ekler bölümü ile düzenleme paneli kardeş bileşenler; aradaki tek bağ bu.
 * Çıkarılan veri hiçbir yerde doğrudan kaydedilmiyor — forma doldurulup
 * kullanıcıya onaylatılıyor (CLAUDE.md, TUZAKLAR #36).
 */
export type Prefill = Partial<ItemDefaults> | null;

type FillContextValue = {
  prefill: Prefill;
  setPrefill: (value: Prefill) => void;
};

const FillContext = createContext<FillContextValue | null>(null);

export function FillProvider({ children }: { children: ReactNode }) {
  const [prefill, setPrefill] = useState<Prefill>(null);
  return (
    <FillContext.Provider value={{ prefill, setPrefill }}>
      {children}
    </FillContext.Provider>
  );
}

export function useFill(): FillContextValue {
  const context = useContext(FillContext);
  if (!context) throw new Error("FillProvider dışında kullanılamaz");
  return context;
}
