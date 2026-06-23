-- CreateEnum
CREATE TYPE "LoanStage" AS ENUM ('lead', 'qualification', 'documentation', 'credit_evaluation', 'approval', 'disbursement', 'servicing', 'rejected');

-- DropIndex
DROP INDEX "Chunk_embedding_hnsw_idx";

-- CreateTable
CREATE TABLE "LoanLead" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "idNumber" TEXT,
    "purpose" TEXT,
    "requestedAmount" DECIMAL(12,2),
    "termMonths" INTEGER,
    "currentStage" "LoanStage" NOT NULL DEFAULT 'lead',
    "coreRequestId" TEXT,
    "lastEligibility" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanConversation" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolCall" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanStageHistory" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "fromStage" "LoanStage",
    "toStage" "LoanStage" NOT NULL,
    "movedBy" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanStageHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoanLead_tenantId_currentStage_idx" ON "LoanLead"("tenantId", "currentStage");

-- CreateIndex
CREATE INDEX "LoanLead_tenantId_phone_idx" ON "LoanLead"("tenantId", "phone");

-- CreateIndex
CREATE INDEX "LoanConversation_leadId_createdAt_idx" ON "LoanConversation"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "LoanStageHistory_leadId_createdAt_idx" ON "LoanStageHistory"("leadId", "createdAt");

-- AddForeignKey
ALTER TABLE "LoanLead" ADD CONSTRAINT "LoanLead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanConversation" ADD CONSTRAINT "LoanConversation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "LoanLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanStageHistory" ADD CONSTRAINT "LoanStageHistory_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "LoanLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
