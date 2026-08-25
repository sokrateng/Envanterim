import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export async function currentUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}

/** Sayfalarda: girişi olmayan /giris'e gider. */
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/giris");
  return user;
}
