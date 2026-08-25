"use client";

import type { ReactNode } from "react";

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block py-2">
      <span className="block pb-1 text-footnote text-muted">{label}</span>
      {children}
      {hint ? <span className="block pt-1 text-caption text-muted">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-card border border-separator bg-bg px-3 py-2.5 text-body outline-none focus:border-blue";

export function SubmitButton({
  children,
  pending,
  tone = "blue",
}: {
  children: ReactNode;
  pending?: boolean;
  tone?: "blue" | "red";
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={`mt-3 min-h-touch w-full rounded-card ${
        tone === "red" ? "bg-red" : "bg-blue"
      } px-4 text-headline text-white transition active:scale-95 disabled:opacity-50`}
    >
      {pending ? "Kaydediliyor…" : children}
    </button>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="pt-2 text-footnote text-red">
      {message}
    </p>
  );
}
