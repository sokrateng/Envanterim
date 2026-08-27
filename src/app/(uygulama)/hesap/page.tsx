import { Group, Row, Rows, Screen, ScreenHeader } from "@/components/ui";
import { SURUM } from "@/lib/constants";
import { isEmailConfigured } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { EmailSettings, type EmailState } from "./EmailSettings";
import { EventSettings } from "./EventSettings";
import { PasswordChange } from "./PasswordChange";
import { PushToggle } from "./PushToggle";
import { SignOutButton } from "./SignOutButton";

export const metadata = { title: "Hesap — Envanterim" };

export default async function HesapPage() {
  const user = await requireUser();
  // Anahtar yoksa bildirim bölümü hiç görünmüyor.
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  // SMTP tanımsızsa e-posta bölümü hiç görünmüyor. Olay tercihleri iki kanalı
  // birden kapsadığı için ayrıca okunuyor.
  const emailEnabled = isEmailConfigured();
  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      email: true,
      emailVerifiedAt: true,
      emailReminders: true,
      notifyNewItem: true,
      notifyItemChange: true,
    },
  });

  const emailState: EmailState = {
    email: account?.email ?? null,
    verified: Boolean(account?.emailVerifiedAt),
    reminders: account?.emailReminders ?? true,
  };

  return (
    <Screen>
      <ScreenHeader title="Hesap" />
      <Group title="Kullanıcı">
        <Rows>
          <Row title={user.name ?? user.username} subtitle={`@${user.username}`} />
          <PasswordChange />
        </Rows>
      </Group>
      {vapidPublicKey || emailEnabled ? (
        <Group title="Bildirimler">
          {vapidPublicKey ? <PushToggle publicKey={vapidPublicKey} /> : null}
          {emailEnabled ? <EmailSettings state={emailState} /> : null}
          <EventSettings
            newItem={account?.notifyNewItem ?? true}
            itemChange={account?.notifyItemChange ?? false}
          />
        </Group>
      ) : null}

      {/* Sürüm: "bendeki eski mi?" sorusu servis konuşmalarında sürekli
          çıkıyor; kullanıcıya soracak yer lazım. */}
      <Group title="Hakkında">
        <Rows>
          <Row title="Uygulama" value="Envanterim" />
          <Row title="Sürüm" value={SURUM} />
        </Rows>
      </Group>

      <Group>
        <SignOutButton />
      </Group>
    </Screen>
  );
}
