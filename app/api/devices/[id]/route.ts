import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  authenticateDevice,
  clearSessionCookie,
  isSameOrigin,
} from "@/lib/guardian-auth";

export const dynamic = "force-dynamic";

/**
 * Widerruf. Auf das eigene Gerät angewandt ist das gleichzeitig "Abmelden".
 * Ein Gerät darf nur andere Geräte rauswerfen, die einen Rechner teilen —
 * sonst könnte ein gekoppeltes Handy fremde Kopplungen kappen.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "bad origin" }, { status: 403 });
  }

  const device = await authenticateDevice();
  if (!device) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const machineIds = device.machines.map((m) => m.machineId);

  const target = await prisma.device.findFirst({
    where: {
      id,
      revokedAt: null,
      machines: { some: { machineId: { in: machineIds } } },
    },
    select: { id: true },
  });

  // 404 statt 403: eine fremde Geräte-ID soll sich nicht dadurch bestätigen
  // lassen, dass die Antwort anders ausfällt.
  if (!target) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.devicePairing.deleteMany({ where: { deviceId: target.id } }),
    prisma.device.update({
      where: { id: target.id },
      data: { revokedAt: new Date(), sessionHash: null },
    }),
  ]);

  if (target.id === device.id) {
    await clearSessionCookie();
  }

  return NextResponse.json({ revoked: true });
}
