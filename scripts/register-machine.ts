/**
 * Legt eine neue Maschine an und gibt den Agent-Token EINMALIG aus.
 * In der DB landet nur der Hash – der Klartext ist danach weg.
 *
 * Ausführen:
 *   npx tsx scripts/register-machine.ts "Desktop"
 */
import "dotenv/config";
import { randomBytes, createHash } from "crypto";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL ist nicht gesetzt.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const name = process.argv[2];
  if (!name) {
    console.error('Name fehlt. Beispiel: npx tsx scripts/register-machine.ts "Desktop"');
    process.exit(1);
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const machine = await prisma.machine.create({
    data: { name, tokenHash },
  });

  console.log("\nMaschine angelegt:", machine.name, `(${machine.id})`);
  console.log("\nDiese zwei Zeilen in die .env der Tray-App am PC:\n");
  console.log(`AGENT_NAME=${name}`);
  console.log(`AGENT_TOKEN=${token}`);
  console.log("\nDer Token wird nicht nochmal angezeigt.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
