import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { UNAUTHENTICATED, parseBody } from "@/lib/api";
import { locationCreateSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return UNAUTHENTICATED();

  const parsed = await parseBody(request, locationCreateSchema);
  if ("response" in parsed) return parsed.response;

  // Lokasyonu açan kişi sahibidir; üyelik kaydı aynı işlemde kurulur, yoksa
  // sahipsiz bir lokasyon kalabilir.
  const location = await prisma.location.create({
    data: {
      name: parsed.data.name,
      icon: parsed.data.icon,
      members: { create: { userId: user.id, role: "OWNER" } },
    },
    select: { id: true, name: true, icon: true },
  });

  return NextResponse.json(location, { status: 201 });
}
