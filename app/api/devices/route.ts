import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateDevice } from "@/lib/guardian-auth";

export const dynamic = "force-dynamic";

/**
 * Alle Geräte, die mindestens einen Rechner steuern dürfen, den auch DIESES
 * Gerät steuern darf. Ein Handy soll keine Kopplungen zu Rechnern sehen, an
 * denen es selbst nie war.
 */
export async function GET() {
  const device = await authenticateDevice();
  if (!device) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const machineIds = device.machines.map((m) => m.machineId);

  const devices = await prisma.device.findMany({
    where: {
      revokedAt: null,
      machines: { some: { machineId: { in: machineIds } } },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
      lastSeenAt: true,
      machines: { select: { machine: { select: { id: true, name: true } } } },
    },
  });

  return NextResponse.json({
    devices: devices.map((d) => ({
      id: d.id,
      name: d.name,
      isSelf: d.id === device.id,
      createdAt: d.createdAt.toISOString(),
      lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
      machines: d.machines.map((m) => m.machine.name),
    })),
  });
}
