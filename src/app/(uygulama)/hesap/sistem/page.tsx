import { Group, Screen, ScreenHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/admin";
import { resolvePushContact } from "@/lib/app-settings";
import { formatBytes } from "@/lib/backup";
import { backupSummary } from "@/lib/backup-server";
import { BackupPanel, type BackupView } from "./BackupPanel";
import { PushContactForm } from "./PushContactForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sistem — Envanterim" };

// Saatler sunucuda biçimlenip düz metin olarak gidiyor: tarayıcının saat dilimi
// sunucudakinden farklıysa ilk çizim ile istemci çizimi uyuşmazdı (hydration).
const when = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  dateStyle: "medium",
  timeStyle: "short",
});

/**
 * Sistem ayarları: yedekler ve push iletişim adresi. Lokasyondan bağımsız,
 * makinenin tamamını ilgilendiriyor — yalnız sistem yöneticisi görür.
 */
export default async function SistemPage() {
  await requireAdmin();

  const [summary, contact] = await Promise.all([
    backupSummary(),
    resolvePushContact(),
  ]);

  const view: BackupView = {
    health: summary.report.health,
    message: summary.report.message,
    canRun: summary.canRun,
    dir: summary.dir,
    lastAttempt: summary.status
      ? when.format(new Date(summary.status.finishedAt))
      : null,
    files: summary.files.map((file) => ({
      name: file.name,
      kind: file.kind,
      sizeLabel: formatBytes(file.size),
      whenLabel: when.format(new Date(file.modifiedAt)),
    })),
  };

  return (
    <Screen>
      <ScreenHeader title="Sistem" back={{ href: "/hesap", label: "Hesap" }} />

      <Group
        title="Yedekleme"
        footer="Zamanlanmış yedek her gece 03:30'da alınır; son 14 yedek saklanır. Yedekler aynı SD kartta durur: önemli olanı indirip başka bir yerde de sakla."
      >
        <BackupPanel view={view} />
      </Group>

      <Group
        title="Bildirimler"
        footer="Push bildirimleri gönderilirken Apple, Google ve Mozilla'ya bildirilen iletişim adresi. Bir sorun çıkarsa sana bu adresten ulaşırlar. Gizli değil."
      >
        <PushContactForm current={contact.subject} source={contact.source} />
      </Group>
    </Screen>
  );
}
