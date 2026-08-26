import { ServiceWorker } from "@/components/ServiceWorker";
import { TabBar } from "@/components/TabBar";
import { requireUser } from "@/lib/session";

// Bu grubun altındaki her sayfa giriş ister; oturum kontrolü tek yerde.
export default async function UygulamaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();

  return (
    <>
      <main className="min-h-dvh">{children}</main>
      <TabBar />
      <ServiceWorker />
    </>
  );
}
