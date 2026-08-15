import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  authenticateDevice,
  hashToken,
  isSameOrigin,
  startSession,
} from "@/lib/guardian-auth";

export const dynamic = "force-dynamic";

/**
 * Die einzige Route ohne Authentifizierung — sie IST die Anmeldung. Deshalb
 * ein Rate-Limit: der Code hat zwar 64 Bit Entropie, aber unbegrenztes Raten
 * soll trotzdem nicht möglich sein.
 *
 * In-Memory reicht: die App läuft als ein Container. Bei mehreren Instanzen
 * müsste der Zähler in die DB wandern.
 */
const RATE_LIMIT = { max: 10, windowMs: 60_000 };
const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);

  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    // Gelegentlich aufräumen, damit die Map nicht unbegrenzt wächst.
    if (attempts.size > 1000) {
      for (const [k, v] of attempts) if (now > v.resetAt) attempts.delete(k);
    }
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT.max;
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0].trim() ?? "unknown";
}

/** Grober Gerätename aus dem User-Agent. Nur zur Anzeige in der Liste. */
function deviceNameFrom(userAgent: string | null): string {
  if (!userAgent) return "Unbekanntes Gerät";
  if (/iPhone/i.test(userAgent)) return "iPhone";
  if (/iPad/i.test(userAgent)) return "iPad";
  if (/Android/i.test(userAgent)) return "Android-Handy";
  if (/Windows/i.test(userAgent)) return "Windows-Rechner";
  if (/Mac OS X/i.test(userAgent)) return "Mac";
  return "Unbekanntes Gerät";
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: "bad origin" }, { status: 403 });
  }

  if (rateLimited(clientIp(req))) {
    return NextResponse.json({ error: "too many attempts" }, { status: 429 });
  }

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const code = body.code?.trim();
  if (!code) {
    return NextResponse.json({ error: "code fehlt" }, { status: 400 });
  }

  // Ein Gerät, das schon angemeldet ist, koppelt einen WEITEREN Rechner —
  // dann behält es seine Session und bekommt nur eine Kopplung dazu.
  const existing = await authenticateDevice();

  const result = await prisma.$transaction(async (tx) => {
    // Prüfen und Entwerten in einer Transaktion, damit zwei gleichzeitige
    // Anfragen mit demselben Code nicht beide durchkommen. Gleiches Muster
    // wie beim Abholen der Befehle im Heartbeat.
    const pairing = await tx.pairingCode.findUnique({
      where: { codeHash: hashToken(code) },
      include: { machine: { select: { id: true, name: true } } },
    });

    if (!pairing || pairing.usedAt || pairing.expiresAt < new Date()) {
      return null;
    }

    await tx.pairingCode.update({
      where: { id: pairing.id },
      data: { usedAt: new Date() },
    });

    const device =
      existing ??
      (await tx.device.create({
        data: { name: deviceNameFrom(req.headers.get("user-agent")) },
      }));

    await tx.devicePairing.upsert({
      where: {
        deviceId_machineId: {
          deviceId: device.id,
          machineId: pairing.machineId,
        },
      },
      create: { deviceId: device.id, machineId: pairing.machineId },
      update: {},
    });

    return { deviceId: device.id, isNew: !existing, machine: pairing.machine };
  });

  if (!result) {
    return NextResponse.json(
      { error: "Code ist abgelaufen oder wurde schon benutzt." },
      { status: 400 }
    );
  }

  // Nur ein frisches Gerät bekommt eine neue Session — ein bestehendes
  // behält seine, sonst würde das Koppeln eines zweiten Rechners das
  // Cookie unnötig rotieren.
  if (result.isNew) {
    await startSession(result.deviceId);
  }

  return NextResponse.json({ machine: result.machine.name });
}
