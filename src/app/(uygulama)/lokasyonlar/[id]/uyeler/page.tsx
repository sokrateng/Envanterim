import { notFound } from "next/navigation";
import { Badge, Group, Rows, Screen, ScreenHeader } from "@/components/ui";
import { requireLocation } from "@/lib/access";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { canManageMembers } from "@/lib/permissions";
import { inviteState } from "@/lib/invite";
import { prisma } from "@/lib/prisma";
import { InviteCodes, type InviteView } from "./InviteCodes";
import { InviteMemberButton } from "./InviteMemberButton";
import { MemberRow } from "./MemberRow";

export const dynamic = "force-dynamic";

export default async function UyelerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await requireLocation(id);
  if (!access) notFound();

  const location = await prisma.location.findUnique({
    where: { id },
    select: {
      name: true,
      invites: {
        select: {
          id: true,
          code: true,
          role: true,
          expiresAt: true,
          usedAt: true,
          usedBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
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
  const dateFormat = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
  });

  // Davet kodları yalnız sahibe gider: istemciye giden veri zaten filtreli.
  const invites: InviteView[] = isOwner
    ? location.invites.map((invite) => ({
        id: invite.id,
        code: invite.code,
        role: invite.role as Role,
        state: inviteState(invite),
        expiresAt: `${dateFormat.format(invite.expiresAt)} tarihine kadar`,
        usedBy: invite.usedBy?.name ?? null,
      }))
    : [];
  const ownerCount = location.members.filter((m) => m.role === "OWNER").length;

  return (
    <Screen>
      <ScreenHeader
        title="Üyeler"
        back={{ href: `/lokasyonlar/${id}`, label: location.name }}
        action={isOwner ? <InviteMemberButton locationId={id} /> : undefined}
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
              locationId={id}
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

      {isOwner ? <InviteCodes locationId={id} invites={invites} /> : null}

      <p className="px-8 pt-6 text-footnote text-muted">
        Roller: {Object.values(ROLE_LABELS).join(" · ")}
      </p>
    </Screen>
  );
}
