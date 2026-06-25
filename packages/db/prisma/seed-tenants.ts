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
    // 'interview' agregado en sprint Demo 07 (ADR-0017) — admisiones
    // universitarias es uno de los casos de uso primarios.
    enabledDemos: [
      'rag',
      'comparator',
      'corpus',
      'agent',
      'tutor',
      'interview',
    ],
    defaultConfig: {
      welcomeCopy:
        'Plataforma de IA para universidades: chat con reglamentos, análisis de corpus académico, agente sobre datos académicos y entrevistas para admisiones.',
    },
  },
  {
    slug: 'banca',
    displayName: 'Banca y servicios financieros',
    // 'interview' agregado en sprint Demo 07 — selección de talento en banca
    // tiene volumen alto y compliance estricto.
    enabledDemos: ['rag', 'comparator', 'agent', 'interview'],
    defaultConfig: {
      welcomeCopy:
        'Plataforma de IA para banca: consulta a regulación, análisis de pólizas, asistente a gerencia y screening de candidatos.',
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
    // 'interview' agregado en sprint Demo 07 — gobiernos seccionales contratan
    // call centers y operativos en alto volumen.
    enabledDemos: ['rag', 'agent', 'tutor', 'interview'],
    defaultConfig: {
      welcomeCopy:
        'Plataforma de IA para gobierno: chat con normativa, agente sobre indicadores, capacitación interna y entrevistas de selección.',
    },
  },
  {
    slug: 'retail',
    displayName: 'Cadenas de tiendas',
    // 'interview' agregado en sprint Demo 07 — retail tiene rotación alta y
    // necesita screening rápido a escala.
    enabledDemos: ['rag', 'agent', 'interview'],
    defaultConfig: {
      welcomeCopy:
        'Plataforma de IA para retail: asistente de catálogo, agente sobre indicadores y entrevistas de primer filtro.',
    },
  },
  {
    slug: 'cooperativas',
    displayName: 'Cooperativas de ahorro y crédito',
    // Vertical agregada en sprint Demo 09 (ADR-0020). CACs ecuatorianas
    // reguladas por SEPS/LOEPS. Acompañan los dos demos cooperativos:
    // notarización (Demo 08) + funnel de préstamos (Demo 09).
    enabledDemos: ['rag', 'agent', 'notarize', 'loans', 'bi'],
    defaultConfig: {
      welcomeCopy:
        'Plataforma de IA para cooperativas de ahorro y crédito: chat con normativa SEPS, agente sobre indicadores, notarización de actas, funnel de préstamos asistido por IA y dashboard inteligente que reemplaza el flujo cubo→Power BI.',
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

  // El equipo de ventas (Edguitar, Luis, Juan Carlos) entra a este tenant
  // con rol `member`. Para que vean los 10 demos en el sidebar (no solo los
  // 6 que hereda la industria 'universidad'), overrideamos enabledDemos
  // explícitamente con todos los IDs del catálogo. La industria sigue
  // siendo 'universidad' por consistencia de copy/welcomeCopy.
  const ALL_DEMOS = [
    'rag',
    'comparator',
    'corpus',
    'agent',
    'tutor',
    'clinical',
    'interview',
    'notarize',
    'loans',
    'bi',
  ];

  const demoTenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {
      displayName: 'Demo · Tenant interno NAI',
      industryId: universidadIndustry.id,
      enabledDemos: ALL_DEMOS,
    },
    create: {
      slug: 'demo',
      displayName: 'Demo · Tenant interno NAI',
      industryId: universidadIndustry.id,
      enabledDemos: ALL_DEMOS,
      branding: {
        accentColor: '#43C194',
        displayName: 'Demo Platform',
      },
      status: 'active',
    },
  });
  console.log(`  ✓ Tenant 'demo' (id: ${demoTenant.id})`);
  console.log(`  ✓ Tenant 'demo' enabledDemos = [${ALL_DEMOS.join(', ')}]`);

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

  // 4) Equipo de ventas (rol member). Acceso a todos los demos via el
  //    enabledDemos override del tenant 'demo'. La contraseña común se lee
  //    de SALES_PASSWORD; default fijo para que el equipo pueda entrar
  //    sin coordinar credenciales.
  const salesPassword = process.env.SALES_PASSWORD ?? 'ventas-demo-2026';
  const salesPasswordHash = await bcrypt.hash(salesPassword, BCRYPT_COST);
  const SALES_TEAM = [
    { email: 'edguitar@nai.local', displayName: 'Edguitar (Ventas)' },
    { email: 'luis@nai.local', displayName: 'Luis (Ventas)' },
    { email: 'juancarlos@nai.local', displayName: 'Juan Carlos (Ventas)' },
  ];
  for (const s of SALES_TEAM) {
    await prisma.user.upsert({
      where: { email: s.email },
      update: {
        passwordHash: salesPasswordHash,
        role: 'member',
        tenantId: demoTenant.id,
        displayName: s.displayName,
      },
      create: {
        email: s.email,
        passwordHash: salesPasswordHash,
        displayName: s.displayName,
        role: 'member',
        tenantId: demoTenant.id,
      },
    });
    console.log(`  ✓ Sales user: ${s.email}`);
  }
  console.log(`  ⚠ Contraseña común equipo ventas: ${salesPassword}`);

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
