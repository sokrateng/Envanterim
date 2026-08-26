import { redirect } from "next/navigation";
import { isEmailConfigured } from "@/lib/mailer";
import { currentUser } from "@/lib/session";
import { ResetForm } from "./ResetForm";

export const metadata = { title: "Şifre sıfırlama — Envanterim" };

export default async function SifrePage() {
  const user = await currentUser();
  if (user) redirect("/hesap");
  // E-posta kapalıysa sıfırlanacak kanal yok; sayfa da olmasın.
  if (!isEmailConfigured()) redirect("/giris");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col justify-center px-6 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <h1 className="text-large-title">Şifreni sıfırla</h1>
      <p className="pt-1 text-subheadline text-muted">
        Hesabına bağlı doğrulanmış e-posta adresine altı haneli bir kod gider.
      </p>
      <ResetForm />
    </main>
  );
}
