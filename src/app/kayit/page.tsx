import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { RegisterForm } from "./RegisterForm";

export const metadata = { title: "Kayıt — Envanterim" };

export default async function KayitPage({
  searchParams,
}: {
  searchParams: Promise<{ kod?: string }>;
}) {
  const user = await currentUser();
  if (user) redirect("/lokasyonlar");

  const { kod } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col justify-center px-6 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <h1 className="text-large-title">Hesap aç</h1>
      <p className="pt-1 text-subheadline text-muted">
        Sana verilen davet kodu ile hesabını aç; davet edildiğin lokasyona
        doğrudan üye olursun.
      </p>
      <RegisterForm defaultCode={kod ?? ""} />
      <p className="pt-4 text-footnote text-muted">
        Hesabın var mı?{" "}
        <Link href="/giris" className="text-blue">
          Giriş yap
        </Link>
      </p>
    </main>
  );
}
