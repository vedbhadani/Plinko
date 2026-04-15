-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "commitHex" TEXT NOT NULL,
    "serverSeed" TEXT,
    "clientSeed" TEXT,
    "combinedSeed" TEXT,
    "pegMapHash" TEXT,
    "rows" INTEGER NOT NULL DEFAULT 12,
    "dropColumn" INTEGER,
    "binIndex" INTEGER,
    "payoutMultiplier" DOUBLE PRECISION,
    "betCents" INTEGER,
    "pathJson" TEXT,
    "revealedAt" TIMESTAMP(3),

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);
