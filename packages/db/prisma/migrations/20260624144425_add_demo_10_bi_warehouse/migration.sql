-- CreateTable
CREATE TABLE "BiAgencia" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "provincia" TEXT NOT NULL,
    "fechaApertura" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BiAgencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiSocio" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agenciaId" TEXT NOT NULL,
    "fechaIngreso" TIMESTAMP(3) NOT NULL,
    "edad" INTEGER NOT NULL,
    "sexo" TEXT NOT NULL,
    "ocupacion" TEXT NOT NULL,
    "ingresoMensualUsd" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "BiSocio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiPrestamo" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "socioId" TEXT NOT NULL,
    "agenciaId" TEXT NOT NULL,
    "productoTipo" TEXT NOT NULL,
    "montoUsd" DECIMAL(12,2) NOT NULL,
    "plazoMeses" INTEGER NOT NULL,
    "tasaAnual" DECIMAL(5,2) NOT NULL,
    "fechaDesembolso" TIMESTAMP(3) NOT NULL,
    "fechaCancelacion" TIMESTAMP(3),
    "estado" TEXT NOT NULL,
    "diasMora" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BiPrestamo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiCaptacion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "socioId" TEXT NOT NULL,
    "agenciaId" TEXT NOT NULL,
    "productoTipo" TEXT NOT NULL,
    "saldoUsd" DECIMAL(12,2) NOT NULL,
    "fechaApertura" TIMESTAMP(3) NOT NULL,
    "fechaCierre" TIMESTAMP(3),
    "estado" TEXT NOT NULL,

    CONSTRAINT "BiCaptacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiCuota" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "prestamoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "fechaProgramada" TIMESTAMP(3) NOT NULL,
    "fechaPago" TIMESTAMP(3),
    "montoUsd" DECIMAL(10,2) NOT NULL,
    "estado" TEXT NOT NULL,
    "diasAtraso" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BiCuota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BiAgencia_tenantId_provincia_idx" ON "BiAgencia"("tenantId", "provincia");

-- CreateIndex
CREATE UNIQUE INDEX "BiAgencia_tenantId_codigo_key" ON "BiAgencia"("tenantId", "codigo");

-- CreateIndex
CREATE INDEX "BiSocio_tenantId_agenciaId_idx" ON "BiSocio"("tenantId", "agenciaId");

-- CreateIndex
CREATE INDEX "BiSocio_tenantId_ocupacion_idx" ON "BiSocio"("tenantId", "ocupacion");

-- CreateIndex
CREATE INDEX "BiPrestamo_tenantId_agenciaId_estado_idx" ON "BiPrestamo"("tenantId", "agenciaId", "estado");

-- CreateIndex
CREATE INDEX "BiPrestamo_tenantId_productoTipo_idx" ON "BiPrestamo"("tenantId", "productoTipo");

-- CreateIndex
CREATE INDEX "BiPrestamo_tenantId_fechaDesembolso_idx" ON "BiPrestamo"("tenantId", "fechaDesembolso");

-- CreateIndex
CREATE INDEX "BiCaptacion_tenantId_agenciaId_estado_idx" ON "BiCaptacion"("tenantId", "agenciaId", "estado");

-- CreateIndex
CREATE INDEX "BiCaptacion_tenantId_productoTipo_idx" ON "BiCaptacion"("tenantId", "productoTipo");

-- CreateIndex
CREATE INDEX "BiCuota_tenantId_prestamoId_idx" ON "BiCuota"("tenantId", "prestamoId");

-- CreateIndex
CREATE INDEX "BiCuota_tenantId_estado_idx" ON "BiCuota"("tenantId", "estado");

-- AddForeignKey
ALTER TABLE "BiAgencia" ADD CONSTRAINT "BiAgencia_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiSocio" ADD CONSTRAINT "BiSocio_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiSocio" ADD CONSTRAINT "BiSocio_agenciaId_fkey" FOREIGN KEY ("agenciaId") REFERENCES "BiAgencia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiPrestamo" ADD CONSTRAINT "BiPrestamo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiPrestamo" ADD CONSTRAINT "BiPrestamo_socioId_fkey" FOREIGN KEY ("socioId") REFERENCES "BiSocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiCaptacion" ADD CONSTRAINT "BiCaptacion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiCaptacion" ADD CONSTRAINT "BiCaptacion_socioId_fkey" FOREIGN KEY ("socioId") REFERENCES "BiSocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiCuota" ADD CONSTRAINT "BiCuota_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiCuota" ADD CONSTRAINT "BiCuota_prestamoId_fkey" FOREIGN KEY ("prestamoId") REFERENCES "BiPrestamo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
