-- CreateTable
CREATE TABLE "machines" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'offline',
    "reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "msUntilSleep" INTEGER,
    "action" TEXT NOT NULL DEFAULT 'sleep',
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "machines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_commands" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "machine_commands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "machines_tokenHash_key" ON "machines"("tokenHash");

-- CreateIndex
CREATE INDEX "machine_commands_machineId_consumedAt_idx" ON "machine_commands"("machineId", "consumedAt");

-- AddForeignKey
ALTER TABLE "machine_commands" ADD CONSTRAINT "machine_commands_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
