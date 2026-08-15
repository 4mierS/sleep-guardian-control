import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateAgent } from "@/lib/guardian-auth";

export const dynamic = "force-dynamic";

/**
 * Der Notaus aus dem Tray-Menü: wirft alle Handys raus, die diesen PC
 * steuern dürfen. Muss vom PC aus gehen, weil genau dann, wenn das Handy
 * weg ist, das Handy als Bedienweg ausfällt.
 */
export async function POST(req: Request) {
  const machine = await authenticateAgent(req);
  if (!machine) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const revoked = await prisma.$transaction(async (tx) => {
    const pairings = await tx.devicePairing.findMany({
      where: { machineId: machine.id },
      select: { deviceId: true },
    });
    const deviceIds = pairings.map((p) => p.deviceId);
    if (deviceIds.length === 0) return 0;

    await tx.devicePairing.deleteMany({ where: { machineId: machine.id } });

    // Ein Gerät, das danach noch andere Rechner steuert, bleibt angemeldet —
    // es verliert nur diesen hier. Wer gar nichts mehr hat, fliegt ganz raus.
    const orphaned = await tx.device.findMany({
      where: { id: { in: deviceIds }, machines: { none: {} }, revokedAt: null },
      select: { id: true },
    });

    if (orphaned.length > 0) {
      await tx.device.updateMany({
        where: { id: { in: orphaned.map((d) => d.id) } },
        data: { revokedAt: new Date(), sessionHash: null },
      });
    }

    return deviceIds.length;
  });

  return NextResponse.json({ revoked });
}
