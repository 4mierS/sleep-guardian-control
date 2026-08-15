import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

/** Token -> SHA-256 Hex. Nur der Hash landet in der DB. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const SESSION_COOKIE = "guardian_session";

/** Die Kopplung läuft nicht ab — Sicherheit kommt über den Widerruf. */
const SESSION_MAX_AGE_S = 10 * 365 * 24 * 60 * 60;

/**
 * Liest den Bearer-Token aus dem Header und sucht die passende Maschine.
 * Gibt null zurück, wenn kein/ungültiger Token.
 */
export async function authenticateAgent(req: Request) {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const token = header.slice(7).trim();
  if (!token) return null;

  return prisma.machine.findUnique({
    where: { tokenHash: hashToken(token) },
  });
}

/**
 * Erzeugt eine neue Session für ein Gerät und setzt das Cookie. Der Klartext
 * verlässt den Server ausschließlich als HttpOnly-Cookie — kein JavaScript im
 * Browser kommt an ihn heran, und keine Route gibt ihn je im Body zurück.
 */
export async function startSession(deviceId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");

  await prisma.device.update({
    where: { id: deviceId },
    data: { sessionHash: hashToken(token) },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export type AuthenticatedDevice = NonNullable<
  Awaited<ReturnType<typeof authenticateDevice>>
>;

/**
 * Authentifiziert die Handy-App über das Session-Cookie. Widerrufene Geräte
 * gelten als nicht angemeldet.
 */
export async function authenticateDevice() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const device = await prisma.device.findUnique({
    where: { sessionHash: hashToken(token) },
    include: { machines: { select: { machineId: true } } },
  });

  if (!device || device.revokedAt) return null;

  // Nicht abwarten: der Zeitstempel ist reine Anzeige in der Geräteliste,
  // die Antwort soll deswegen nicht langsamer werden.
  void prisma.device
    .update({ where: { id: device.id }, data: { lastSeenAt: new Date() } })
    .catch(() => {});

  return device;
}

/** Darf dieses Gerät die Maschine steuern? */
export function devicePairedWith(
  device: { machines: { machineId: string }[] },
  machineId: string
): boolean {
  return device.machines.some((m) => m.machineId === machineId);
}

/**
 * CSRF-Schutz für alle zustandsändernden Routen. Mit Cookie-Auth kann eine
 * fremde Seite sonst Anfragen im Namen deines angemeldeten Browsers stellen.
 * `SameSite=strict` deckt das schon weitgehend ab — das hier ist die zweite
 * Linie für Browser und Sonderfälle, in denen das nicht greift.
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  // Kein Origin-Header: same-origin-Anfragen ohne CORS-Kontext (z.B. curl).
  // Die sind für CSRF irrelevant, weil kein fremder Browser sie auslöst.
  if (!origin) return true;

  const host = req.headers.get("host");
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
