-- CreateEnum
CREATE TYPE "AbsenceSource" AS ENUM ('FACTORIAL', 'LOKAL');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'VERTRETUNG_NOETIG';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "emailedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "sourceEmailFrom" TEXT,
ADD COLUMN     "sourceEmailId" TEXT,
ADD COLUMN     "sourceEmailLink" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "factorialEmployeeId" TEXT,
ADD COLUMN     "notifyByEmail" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "absences" (
    "id" TEXT NOT NULL,
    "source" "AbsenceSource" NOT NULL DEFAULT 'FACTORIAL',
    "userId" TEXT,
    "factorialLeaveId" TEXT,
    "factorialEmployeeId" TEXT,
    "employeeName" TEXT,
    "startOn" TIMESTAMP(3) NOT NULL,
    "finishOn" TIMESTAMP(3),
    "halfDay" TEXT,
    "leaveTypeName" TEXT,
    "description" TEXT,
    "approved" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "absences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factorial_sync_logs" (
    "id" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL,
    "message" TEXT,
    "employeesMatched" INTEGER NOT NULL DEFAULT 0,
    "usersCreated" INTEGER NOT NULL DEFAULT 0,
    "absencesSynced" INTEGER NOT NULL DEFAULT 0,
    "unmatched" JSONB,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "factorial_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "absences_factorialLeaveId_key" ON "absences"("factorialLeaveId");

-- CreateIndex
CREATE INDEX "absences_userId_startOn_idx" ON "absences"("userId", "startOn");

-- CreateIndex
CREATE INDEX "factorial_sync_logs_createdAt_idx" ON "factorial_sync_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_factorialEmployeeId_key" ON "users"("factorialEmployeeId");

-- AddForeignKey
ALTER TABLE "absences" ADD CONSTRAINT "absences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CreateIndex
CREATE INDEX "tasks_sourceEmailId_idx" ON "tasks"("sourceEmailId");

