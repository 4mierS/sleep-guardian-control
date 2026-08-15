import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateDevice } from "@/lib/guardian-auth";

export const dynamic = "force-dynamic";

/** Wenn der letzte Heartbeat älter als das ist, gilt der PC als offline. */
const OFFLINE_AFTER_MS = 30_000;

export async function GET() {
  const device = await authenticateDevice();
  if (!device) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const machines = await prisma.machine.findMany({
    // Nur die Rechner, für die dieses Gerät gekoppelt wurde.
    where: { id: { in: device.machines.map((m) => m.machineId) } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      state: true,
      reasons: true,
      msUntilSleep: true,
      action: true,
      lastSeenAt: true,
    },
  });

  const now = Date.now();

  return NextResponse.json({
    machines: machines.map((m) => {
      const stale =
        !m.lastSeenAt || now - m.lastSeenAt.getTime() > OFFLINE_AFTER_MS;

      return {
        ...m,
        // Der PC meldet nie "offline" über sich selbst – das leiten wir
        // daraus ab, dass der Heartbeat ausbleibt (PC schläft schon,
        // ist aus, oder hat kein Netz).
        state: stale ? "offline" : m.state,
        lastSeenAt: m.lastSeenAt?.toISOString() ?? null,
      };
    }),
  });
}
