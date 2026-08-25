import { Group, Row, Rows, Screen, ScreenHeader } from "@/components/ui";
import { requireUser } from "@/lib/session";
import { SignOutButton } from "./SignOutButton";

export const metadata = { title: "Hesap — Envanterim" };

export default async function HesapPage() {
  const user = await requireUser();

  return (
    <Screen>
      <ScreenHeader title="Hesap" />
      <Group title="Kullanıcı">
        <Rows>
          <Row title={user.name ?? user.username} subtitle={`@${user.username}`} />
        </Rows>
      </Group>
      <Group>
        <SignOutButton />
      </Group>
    </Screen>
  );
}
