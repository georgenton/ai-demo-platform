// -----------------------------------------------------------------------------
// Seed de Industries + Tenant interno + superadmin user.
//
// Corre ANTES que cualquier otro seed que asume datos existentes. Sin esto:
//   - No hay Industries para vincular Tenants.
//   - No hay Tenant para vincular Users.
//   - No hay superadmin para administrar el sistema.
//
// Idempotente vía upsert: re-correrlo no rompe nada ni duplica filas.
//
// Cómo correr:
//   npm run db:seed:tenants  (local con .env)
//
// Cuando entren los demos viejos en PR-MT2, sus seeds se actualizan para
// asignar todos los documentos al tenant 'demo'.
// -----------------------------------------------------------------------------

import { PrismaClient } from '../generated/client/client.js';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const BCRYPT_COST = 12;

// ---------------------------------------------------------------------------
// Catálogo de industries (ADR-0013, runbook apéndice A)
// ---------------------------------------------------------------------------

const INDUSTRIES = [
  {
    slug: 'universidad',
    displayName: 'Educación superior',
    enabledDemos: ['rag', 'comparator', 'corpus', 'agent', 'tutor'],
    defaultConfig: {
      welcomeCopy:
        'Plataforma de IA para universidades: chat con reglamentos, análisis de corpus académico y agente sobre datos académicos.',
    },
  },
  {
    slug: 'banca',
    displayName: 'Banca y servicios financieros',
    enabledDemos: ['rag', 'comparator', 'agent'],
    defaultConfig: {
      welcomeCopy:
        'Plataforma de IA para banca: consulta a regulación, análisis de pólizas y asistente a gerencia.',
    },
  },
  {
    slug: 'legal',
    displayName: 'Estudios profesionales legales',
    enabledDemos: ['rag', 'comparator', 'corpus'],
    defaultConfig: {
      welcomeCopy:
        'Plataforma de IA para estudios legales: chat con jurisprudencia, comparador de contratos y análisis de tendencias.',
    },
  },
  {
    slug: 'salud',
    // Demo 06 ('clinical') agregado en sprint Demo 06: primer demo
    // nicho-salud (ADR-0016). Los pacientes ficticios viven en el tenant
    // compartido 'clinical-shared' que el ClinicalService resuelve internamente.
    displayName: 'Clínicas y centros médicos',
    enabledDemos: ['rag', 'agent', 'clinical'],
    defaultConfig: {
      welcomeCopy:
        'Plataforma de IA para salud: protocolos clínicos consultables, asistente sobre la historia del paciente y agente sobre indicadores hospitalarios.',
    },
  },
  {
    slug: 'gobierno',
    displayName: 'Sector público',
    enabledDemos: ['rag', 'agent', 'tutor'],
    defaultConfig: {
      welcomeCopy:
        'Plataforma de IA para gobierno: chat con normativa, agente sobre indicadores y capacitación interna.',
    },
  },
  {
    slug: 'retail',
    displayName: 'Cadenas de tiendas',
    enabledDemos: ['rag', 'agent'],
    defaultConfig: {
      welcomeCopy:
        'Plataforma de IA para retail: asistente de catálogo y agente sobre indicadores de venta.',
    },
  },
] as const;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('🌱 Seeding industries + internal tenant + superadmin...');

  // 1) Industries — upsert por slug.
  for (const ind of INDUSTRIES) {
    await prisma.industry.upsert({
      where: { slug: ind.slug },
      update: {
        displayName: ind.displayName,
        enabledDemos: [...ind.enabledDemos],
        defaultConfig: ind.defaultConfig,
      },
      create: {
        slug: ind.slug,
        displayName: ind.displayName,
        enabledDemos: [...ind.enabledDemos],
        defaultConfig: ind.defaultConfig,
      },
    });
  }
  console.log(`  ✓ ${INDUSTRIES.length} industries`);

  // 2) Tenant interno "demo" en la industria universidad. Sirve como
  //    "tenant administrativo" — los superadmins lo tienen como home y los
  //    documentos heredados de la app pre-multitenant se migran acá.
  const universidadIndustry = await prisma.industry.findUnique({
    where: { slug: 'universidad' },
  });
  if (!universidadIndustry) {
    throw new Error(
      "La industria 'universidad' debería existir tras el paso 1",
    );
  }

  const demoTenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {
      displayName: 'Demo · Tenant interno NAI',
      industryId: universidadIndustry.id,
    },
    create: {
      slug: 'demo',
      displayName: 'Demo · Tenant interno NAI',
      industryId: universidadIndustry.id,
      enabledDemos: [],
      branding: {
        accentColor: '#43C194',
        displayName: 'Demo Platform',
      },
      status: 'active',
    },
  });
  console.log(`  ✓ Tenant 'demo' (id: ${demoTenant.id})`);

  // 3) Superadmin user. La contraseña se toma del env DEMO_ADMIN_PASSWORD
  //    o usa el default. EN PRODUCCIÓN cambiar la contraseña del seed
  //    inmediatamente después del primer login.
  const adminEmail = (
    process.env.DEMO_ADMIN_EMAIL ?? 'admin@nai.local'
  ).toLowerCase();
  const adminPassword = process.env.DEMO_ADMIN_PASSWORD ?? 'demo-platform-2026';
  const passwordHash = await bcrypt.hash(adminPassword, BCRYPT_COST);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash,
      role: 'superadmin',
      tenantId: demoTenant.id,
    },
    create: {
      email: adminEmail,
      passwordHash,
      displayName: 'Superadmin Demo',
      role: 'superadmin',
      tenantId: demoTenant.id,
    },
  });
  console.log(`  ✓ Superadmin user: ${adminEmail}`);
  console.log(`  ⚠ Contraseña inicial: ${adminPassword}`);
  console.log('  ⚠ CÁMBIALA en producción tras el primer login.');

  console.log('🎉 Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
