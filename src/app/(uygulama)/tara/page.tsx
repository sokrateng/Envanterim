import { Screen, ScreenHeader } from "@/components/ui";
import { requireUser } from "@/lib/session";
import { Scanner } from "./Scanner";

export const metadata = { title: "Tara — Envanterim" };

export default async function TaraPage() {
  await requireUser();

  return (
    <Screen>
      <ScreenHeader title="Tara" back={{ href: "/envanter", label: "Envanter" }} />
      <Scanner />
    </Screen>
  );
}
