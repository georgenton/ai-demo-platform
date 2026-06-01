-- =============================================================================
-- Migración multi-tenant (PR-MT2, ADR-0013)
--
-- Document y AgentQuery reciben tenantId. La migración:
--   1) Agrega la columna nullable.
--   2) Asegura que existe el tenant 'demo' (de PR-MT1) y popula con su id.
--   3) Vuelve la columna NOT NULL y agrega la FK + índices.
--
-- Tres pasos en vez de uno porque las tablas pueden tener filas existentes
-- de la era pre-multi-tenant: si agregamos NOT NULL de una sola vez la
-- migración explota con "null value in column ... violates not-null".
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Paso 1 — drop de los índices viejos (los nuevos los crea Prisma al final)
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS "AgentQuery_createdAt_idx";
DROP INDEX IF EXISTS "Document_demoId_idx";
DROP INDEX IF EXISTS "Document_demoId_year_idx";

-- ---------------------------------------------------------------------------
-- Paso 2 — agregar tenantId como nullable
-- ---------------------------------------------------------------------------

ALTER TABLE "Document" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "AgentQuery" ADD COLUMN "tenantId" TEXT;

-- ---------------------------------------------------------------------------
-- Paso 3 — asegurar tenant 'demo' (idempotente) y popular las filas viejas
--
-- El seed-tenants.ts ya lo crea, pero la migración no puede asumir que el
-- seed corrió. Hacemos un INSERT condicional: si ya existe el tenant 'demo',
-- no hace nada; si no existe, lo crea y a la vez crea la industry
-- 'universidad' a la que apunta.
--
-- Después un UPDATE masivo deja todas las filas viejas en ese tenant.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  uni_id TEXT;
  demo_id TEXT;
BEGIN
  -- Asegurar industry 'universidad' (idempotente).
  SELECT id INTO uni_id FROM "Industry" WHERE slug = 'universidad';
  IF uni_id IS NULL THEN
    uni_id := 'cmig_universidad_seed';
    INSERT INTO "Industry" (id, slug, "displayName", "enabledDemos", "defaultConfig", "createdAt")
    VALUES (uni_id, 'universidad', 'Educación superior',
            ARRAY['rag', 'comparator', 'corpus', 'agent', 'tutor'],
            '{}'::jsonb, NOW());
  END IF;

  -- Asegurar tenant 'demo' (idempotente).
  SELECT id INTO demo_id FROM "Tenant" WHERE slug = 'demo';
  IF demo_id IS NULL THEN
    demo_id := 'ctnt_demo_migration';
    INSERT INTO "Tenant" (id, slug, "displayName", "industryId", "enabledDemos",
                          "branding", "status", "createdAt")
    VALUES (demo_id, 'demo', 'Demo · Tenant interno NAI', uni_id,
            ARRAY[]::TEXT[], '{}'::jsonb, 'active', NOW());
  END IF;

  -- Backfill de las tablas existentes.
  UPDATE "Document" SET "tenantId" = demo_id WHERE "tenantId" IS NULL;
  UPDATE "AgentQuery" SET "tenantId" = demo_id WHERE "tenantId" IS NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Paso 4 — volver tenantId NOT NULL ahora que todas las filas tienen valor
-- ---------------------------------------------------------------------------

ALTER TABLE "Document" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "AgentQuery" ALTER COLUMN "tenantId" SET NOT NULL;

-- ---------------------------------------------------------------------------
-- Paso 5 — índices y foreign keys
-- ---------------------------------------------------------------------------

CREATE INDEX "AgentQuery_tenantId_createdAt_idx" ON "AgentQuery"("tenantId", "createdAt" DESC);
CREATE INDEX "Document_tenantId_demoId_idx" ON "Document"("tenantId", "demoId");
CREATE INDEX "Document_tenantId_demoId_year_idx" ON "Document"("tenantId", "demoId", "year");

ALTER TABLE "Document" ADD CONSTRAINT "Document_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentQuery" ADD CONSTRAINT "AgentQuery_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
