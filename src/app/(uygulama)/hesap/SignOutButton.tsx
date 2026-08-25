"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/giris" })}
      className="min-h-touch w-full px-4 text-body text-red active:bg-surface-pressed"
    >
      Çıkış yap
    </button>
  );
}
