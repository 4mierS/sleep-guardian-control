import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateAgent, hashToken } from "@/lib/guardian-auth";

export const dynamic = "force-dynamic";

/** So lange gilt ein Code. Kurz genug, dass ein abfotografierter QR nutzlos ist. */
const CODE_TTL_MS = 90_000;

/**
 * Die Tray-App fordert hier einen Einmal-Code an und zeigt ihn als QR.
 * Nur der PC selbst kann das — er weist sich mit seinem Agent-Token aus.
 * Damit ist "wer physisch am Rechner sitzt, darf koppeln" durchgesetzt.
 */
export async function POST(req: Request) {
  const machine = await authenticateAgent(req);
  if (!machine) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 8 Bytes = 11 Zeichen base64url. Genug Entropie gegen Raten, kurz genug,
  // dass man ihn im Notfall abtippen kann.
  const code = randomBytes(8).toString("base64url");
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await prisma.$transaction([
    // Es gibt nie zwei gültige Codes gleichzeitig: ein neuer entwertet den
    // alten. Sonst bliebe ein weggeklicktes QR-Fenster still weiter gültig.
    prisma.pairingCode.updateMany({
      where: { machineId: machine.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.pairingCode.create({
      data: { machineId: machine.id, codeHash: hashToken(code), expiresAt },
    }),
  ]);

  return NextResponse.json({ code, expiresAt: expiresAt.toISOString() });
}
