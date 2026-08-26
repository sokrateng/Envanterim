import { redirect } from "next/navigation";
import { isEmailConfigured } from "@/lib/mailer";
import { currentUser } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Giriş — Envanterim" };

export default async function GirisPage() {
  const user = await currentUser();
  if (user) redirect("/lokasyonlar");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col justify-center px-6 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <h1 className="text-large-title">Envanterim</h1>
      <p className="pt-1 text-subheadline text-muted">
        Ekipmanlarını, garantilerini ve servis geçmişini tek yerde tut.
      </p>
      {/* Sıfırlama e-postaya bağlı; SMTP yoksa bağlantı hiç çıkmıyor. */}
      <LoginForm resetEnabled={isEmailConfigured()} />
    </main>
  );
}
