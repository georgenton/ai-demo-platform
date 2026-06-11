-- =============================================================================
-- Demo 08 — Notarización cooperativa con IA (ADR-0019)
-- =============================================================================
--
-- Esta migración solo agrega tablas + enums nuevos. No toca tablas existentes
-- (cero riesgo para los demos 1–7). Es seguro aplicarla en producción sin
-- backup adicional al estándar.
--
-- Lo que crea:
--   1. Enum NotarizedDocType (assembly-minutes, loan, capital-contribution).
--   2. Enum PublicAnchorStatus (pending, confirmed, failed).
--   3. Tabla NotarizedDocument (el PDF + su hash + análisis IA).
--   4. Tabla LocalAnchor (mini-ledger interno encadenado y firmado).
--   5. Tabla PublicAnchor (registro de anchors on-chain).
--   6. Tabla TenantNotaryKey (keypair RSA por tenant, generada en sub-PR 2).
--
-- ROLLBACK MANUAL (si se necesita):
--
--   DROP TABLE IF EXISTS "TenantNotaryKey";
--   DROP TABLE IF EXISTS "PublicAnchor";
--   DROP TABLE IF EXISTS "LocalAnchor";
--   DROP TABLE IF EXISTS "NotarizedDocument";
--   DROP TYPE IF EXISTS "PublicAnchorStatus";
--   DROP TYPE IF EXISTS "NotarizedDocType";
--
--   Los datos NO se recuperan con el rollback — backup separado si llegó a
--   haber documentos notarizados en producción.
-- =============================================================================


-- 1. Enums --------------------------------------------------------------------

CREATE TYPE "NotarizedDocType" AS ENUM (
  'assembly-minutes',
  'loan',
  'capital-contribution'
);

CREATE TYPE "PublicAnchorStatus" AS ENUM (
  'pending',
  'confirmed',
  'failed'
);


-- 2. NotarizedDocument --------------------------------------------------------

CREATE TABLE "NotarizedDocument" (
  "id"            TEXT NOT NULL,
  "tenantId"      TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "docType"       "NotarizedDocType" NOT NULL,
  "content"       TEXT NOT NULL,
  "contentHash"   TEXT NOT NULL,
  "contentSize"   INTEGER NOT NULL,
  "analysis"      JSONB,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NotarizedDocument_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "NotarizedDocument"
  ADD CONSTRAINT "NotarizedDocument_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "NotarizedDocument_tenantId_docType_idx"
  ON "NotarizedDocument" ("tenantId", "docType");
CREATE INDEX "NotarizedDocument_tenantId_createdAt_idx"
  ON "NotarizedDocument" ("tenantId", "createdAt" DESC);
CREATE INDEX "NotarizedDocument_contentHash_idx"
  ON "NotarizedDocument" ("contentHash");


-- 3. LocalAnchor (mini-ledger interno) ---------------------------------------

CREATE TABLE "LocalAnchor" (
  "id"              TEXT NOT NULL,
  "documentId"      TEXT NOT NULL,
  "tenantId"        TEXT NOT NULL,
  "sequence"        INTEGER NOT NULL,
  "prevAnchorHash"  TEXT NOT NULL,
  "anchorHash"      TEXT NOT NULL,
  "signature"       TEXT NOT NULL,
  "signerKeyId"     TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LocalAnchor_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "LocalAnchor"
  ADD CONSTRAINT "LocalAnchor_documentId_key" UNIQUE ("documentId");

ALTER TABLE "LocalAnchor"
  ADD CONSTRAINT "LocalAnchor_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "NotarizedDocument"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LocalAnchor"
  ADD CONSTRAINT "LocalAnchor_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- sequence es por tenant — distintos tenants tienen sus propios ledgers
-- paralelos arrancando en sequence=0.
CREATE UNIQUE INDEX "LocalAnchor_tenantId_sequence_key"
  ON "LocalAnchor" ("tenantId", "sequence");
CREATE INDEX "LocalAnchor_tenantId_createdAt_idx"
  ON "LocalAnchor" ("tenantId", "createdAt" DESC);
CREATE INDEX "LocalAnchor_anchorHash_idx"
  ON "LocalAnchor" ("anchorHash");


-- 4. PublicAnchor (on-chain) -------------------------------------------------

CREATE TABLE "PublicAnchor" (
  "id"              TEXT NOT NULL,
  "documentId"      TEXT NOT NULL,
  "tenantId"        TEXT NOT NULL,
  "network"         TEXT NOT NULL,
  "txHash"          TEXT,
  "blockNumber"     BIGINT,
  "contractAddress" TEXT,
  "anchoredHash"    TEXT NOT NULL,
  "status"          "PublicAnchorStatus" NOT NULL DEFAULT 'pending',
  "errorMessage"    TEXT,
  "requestedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedAt"     TIMESTAMP(3),

  CONSTRAINT "PublicAnchor_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PublicAnchor"
  ADD CONSTRAINT "PublicAnchor_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "NotarizedDocument"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PublicAnchor"
  ADD CONSTRAINT "PublicAnchor_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "PublicAnchor_documentId_idx"
  ON "PublicAnchor" ("documentId");
CREATE INDEX "PublicAnchor_tenantId_status_idx"
  ON "PublicAnchor" ("tenantId", "status");
CREATE INDEX "PublicAnchor_txHash_idx"
  ON "PublicAnchor" ("txHash");


-- 5. TenantNotaryKey (keypair RSA por tenant) --------------------------------

CREATE TABLE "TenantNotaryKey" (
  "id"                  TEXT NOT NULL,
  "tenantId"            TEXT NOT NULL,
  "algorithm"           TEXT NOT NULL,
  "publicKeyPem"        TEXT NOT NULL,
  "privateKeyEncrypted" TEXT NOT NULL,
  "fingerprint"         TEXT NOT NULL,
  "activatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deactivatedAt"       TIMESTAMP(3),

  CONSTRAINT "TenantNotaryKey_pkey" PRIMARY KEY ("id")
);

-- Un tenant tiene a lo sumo UNA keypair activa. Cuando se rota, la vieja
-- queda con deactivatedAt y se crea una nueva. Para soportar rotación sin
-- chocar con esta unique, en sub-PR 2 movemos esta constraint a un partial
-- index (WHERE deactivatedAt IS NULL). Para ahora basta el unique simple.
ALTER TABLE "TenantNotaryKey"
  ADD CONSTRAINT "TenantNotaryKey_tenantId_key" UNIQUE ("tenantId");

ALTER TABLE "TenantNotaryKey"
  ADD CONSTRAINT "TenantNotaryKey_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "TenantNotaryKey_fingerprint_idx"
  ON "TenantNotaryKey" ("fingerprint");
