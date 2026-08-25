import { notFound } from "next/navigation";
import { Badge, Group, Rows, Screen, ScreenHeader } from "@/components/ui";
import { requireLocation } from "@/lib/access";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { canManageMembers } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { InviteMemberButton } from "./InviteMemberButton";
import { MemberRow } from "./MemberRow";

export const dynamic = "force-dynamic";

export default async function UyelerPage({
  params,
}: {
  params: { id: string };
}) {
  const access = await requireLocation(params.id);
  if (!access) notFound();

  const location = await prisma.location.findUnique({
    where: { id: params.id },
    select: {
      name: true,
      members: {
        select: {
          id: true,
          role: true,
          userId: true,
          user: { select: { name: true, username: true, status: true } },
        },
        orderBy: [{ role: "asc" }, { user: { name: "asc" } }],
      },
    },
  });
  if (!location) notFound();

  const isOwner = canManageMembers(access);
  const ownerCount = location.members.filter((m) => m.role === "OWNER").length;

  return (
    <Screen>
      <ScreenHeader
        title="Üyeler"
        back={{ href: `/lokasyonlar/${params.id}`, label: location.name }}
        action={isOwner ? <InviteMemberButton locationId={params.id} /> : undefined}
      />

      <Group
        title={`${location.members.length} kişi`}
        footer={
          isOwner
            ? "Sahip: her şey. Düzenleyen: ekipman ekler/düzenler. Görüntüleyen: yalnız görür."
            : "Üye eklemeyi yalnız lokasyon sahibi yapabilir."
        }
      >
        <Rows>
          {location.members.map((member) => (
            <MemberRow
              key={member.id}
              locationId={params.id}
              memberId={member.id}
              name={member.user.name}
              username={member.user.username}
              role={member.role as Role}
              isSelf={member.userId === access.userId}
              canManage={isOwner}
              isLastOwner={member.role === "OWNER" && ownerCount <= 1}
              badge={
                member.user.status === "ACTIVE" ? null : (
                  <Badge tone="orange">Pasif</Badge>
                )
              }
            />
          ))}
        </Rows>
      </Group>

      <p className="px-8 pt-4 text-footnote text-muted">
        Roller: {Object.values(ROLE_LABELS).join(" · ")}
      </p>
    </Screen>
  );
}
