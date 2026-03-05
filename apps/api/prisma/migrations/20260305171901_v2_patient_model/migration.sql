-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mrn" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dob" DATETIME,
    "phone" TEXT NOT NULL,
    "phoneAlt" TEXT,
    "email" TEXT,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
    "insuranceProvider" TEXT,
    "insuranceId" TEXT,
    "notes" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Call" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "callerName" TEXT NOT NULL,
    "callerPhone" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "patientId" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "team" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "notes" TEXT,
    "reason" TEXT,
    "disposition" TEXT,
    "dispositionTemplate" TEXT,
    "followUpDate" DATETIME,
    "followUpAssignedTo" TEXT,
    "hipaaAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "recordingConsent" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "duration" INTEGER,
    "transferredToId" TEXT,
    "transferNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Call_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Call_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Call_transferredToId_fkey" FOREIGN KEY ("transferredToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Call_followUpAssignedTo_fkey" FOREIGN KEY ("followUpAssignedTo") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Call_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Call" ("agentId", "callerName", "callerPhone", "categoryId", "completedAt", "createdAt", "duration", "id", "notes", "priority", "startedAt", "status", "team", "transferNotes", "transferredToId", "updatedAt") SELECT "agentId", "callerName", "callerPhone", "categoryId", "completedAt", "createdAt", "duration", "id", "notes", "priority", "startedAt", "status", "team", "transferNotes", "transferredToId", "updatedAt" FROM "Call";
DROP TABLE "Call";
ALTER TABLE "new_Call" RENAME TO "Call";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Patient_mrn_key" ON "Patient"("mrn");
