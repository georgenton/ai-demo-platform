-- CreateTable
CREATE TABLE "BiDashboardItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "sql" TEXT NOT NULL,
    "tablesUsed" TEXT[],
    "chartSpec" JSONB NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BiDashboardItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BiDashboardItem_tenantId_order_idx" ON "BiDashboardItem"("tenantId", "order");

-- AddForeignKey
ALTER TABLE "BiDashboardItem" ADD CONSTRAINT "BiDashboardItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
