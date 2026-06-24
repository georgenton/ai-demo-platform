// -----------------------------------------------------------------------------
// Seed del Demo 09 — Funnel de préstamos cooperativos (ADR-0020, sub-PR 5).
//
// Sin este seed, el primer usuario que entra a /demo/loans/funnel ve el
// estado vacío y no entiende el potencial del demo. Sembramos 8 leads
// distribuidos por todas las etapas del funnel para que el kanban se vea
// realista desde el primer login.
//
// Características:
//   - Determinístico: timestamps base + offsets, sin Date.now ni Math.random.
//   - Idempotente: borra los leads del tenant target antes de recrear. La
//     conversación y el stage history se borran en cascada por FK.
//   - Tenant target: el tenant 'demo-cooperativa' que pertenece a la
//     industria 'cooperativas'. Lo creamos acá mismo si no existe.
//
// Cómo correr:
//   npm run db:seed:loans           # local con .env
//   npm run db:seed:loans:railway   # contra Railway via DATABASE_PUBLIC_URL
//
// IMPORTANTE: este seed asume que `seed-tenants.ts` ya corrió antes
// (necesita la industria 'cooperativas' existente). Si falla con
// "Industria cooperativas no existe", corre primero:
//   npm run db:seed:tenants
// -----------------------------------------------------------------------------

import {
  Prisma,
  PrismaClient,
  type LoanStage,
} from '../generated/client/client.js';

const prisma = new PrismaClient();

const COOP_INDUSTRY_SLUG = 'cooperativas';
const COOP_TENANT_SLUG = 'demo-cooperativa';
const COOP_TENANT_DISPLAY = 'Demo · Cooperativa Andina (ficticia)';

// Fecha base para timestamps determinísticos. El seed entero "vive"
// alrededor de 2026-06-23, simulando una cooperativa con leads en curso
// hace pocos días.
const BASE_DATE = new Date('2026-06-23T14:00:00Z');

function offsetMinutes(min: number): Date {
  return new Date(BASE_DATE.getTime() - min * 60_000);
}

// -----------------------------------------------------------------------------
// Dataset — 8 leads en distintas etapas del funnel
//
// Mezcla deliberada:
//   - 2 en 'lead' (recién contactaron, mínima data).
//   - 1 en 'qualification' (monto definido, falta cédula).
//   - 1 en 'documentation' (pidiendo papeles).
//   - 1 en 'credit_evaluation' (consultando core + corriendo eligibility).
//   - 1 en 'approval' (elegible, listo para firmar).
//   - 1 en 'servicing' (con préstamo activo en cobro).
//   - 1 en 'rejected' (no elegible — score borderline + ratio alto).
// -----------------------------------------------------------------------------

interface SeedLead {
  fullName: string;
  phone: string;
  idNumber: string | null;
  purpose: string | null;
  requestedAmount: string | null;
  termMonths: number | null;
  currentStage: LoanStage;
  coreRequestId: string | null;
  lastEligibility: object | null;
  /** Minutos hacia atrás desde BASE_DATE para createdAt. */
  ageMinutes: number;
  /** Minutos hacia atrás desde BASE_DATE para updatedAt. */
  lastTouchMinutes: number;
  /** Razón del último movimiento de etapa. */
  lastStageReason: string;
  /** Resumen del chat (2-4 turnos). */
  conversation: Array<{
    role: 'user' | 'assistant';
    content: string;
    /** Minutos hacia atrás desde BASE_DATE. */
    minutes: number;
    toolCall?: object;
  }>;
}

const SEED_LEADS: SeedLead[] = [
  {
    fullName: 'María Elena Pacheco Salazar',
    phone: '0991123456',
    idNumber: '0102030405',
    purpose: 'consolidación de deudas y refacción del local',
    requestedAmount: '2000.00',
    termMonths: 12,
    currentStage: 'approval',
    coreRequestId: 'core-req-1',
    lastEligibility: {
      eligible: true,
      verdict: 'Elegible',
      reason:
        'Cumple los requisitos: score 780, ingreso $1450.00, ratio cuota/ingreso 26.0%.',
      maxAmountUsd: '2000.00',
      suggestedRateAnnual: 14,
      estimatedMonthlyPayment: '179.69',
      paymentToIncomeRatio: 0.26,
    },
    ageMinutes: 240,
    lastTouchMinutes: 22,
    lastStageReason:
      'Evaluación crediticia favorable, monto aprobado completo. Pasa a firma.',
    conversation: [
      {
        role: 'user',
        content:
          'Buenas tardes. Soy María Elena Pacheco. Quiero un préstamo de $2000 a 12 meses para refaccionar mi local de comidas.',
        minutes: 240,
      },
      {
        role: 'assistant',
        content:
          'Hola María Elena 👋 Con gusto te ayudo. Te pido tu número de cédula para validar tus datos con la cooperativa.',
        minutes: 239,
      },
      {
        role: 'user',
        content: 'Es la 0102030405.',
        minutes: 236,
      },
      {
        role: 'assistant',
        content:
          'Tu score y capacidad de pago son favorables. Te aprobamos los $2000 a 12 meses al 14% anual, con cuota mensual de aprox. $179.69. ¿Confirmas para pasar a firma del pagaré?',
        minutes: 22,
      },
    ],
  },
  {
    fullName: 'Carlos Andrés Yánez Vargas',
    phone: '0987655443',
    idNumber: '0203040506',
    purpose: 'emergencia médica familiar',
    requestedAmount: '500.00',
    termMonths: 6,
    currentStage: 'credit_evaluation',
    coreRequestId: 'core-req-2',
    lastEligibility: null,
    ageMinutes: 95,
    lastTouchMinutes: 8,
    lastStageReason:
      'Documentos validados, corriendo evaluación con score interno.',
    conversation: [
      {
        role: 'user',
        content:
          'Necesito $500 urgente para una operación. Soy Carlos Yánez, cédula 0203040506. Mi teléfono es 0987655443.',
        minutes: 95,
      },
      {
        role: 'assistant',
        content:
          'Hola Carlos. Lamento la situación. Validé tus datos en el sistema. Estoy corriendo la evaluación crediticia — te confirmo en un momento.',
        minutes: 8,
      },
    ],
  },
  {
    fullName: 'Luis Fernando Chimbo Quishpe',
    phone: '0998123771',
    idNumber: '0405060708',
    purpose: 'capital de trabajo para taller mecánico',
    requestedAmount: '3500.00',
    termMonths: 24,
    currentStage: 'rejected',
    coreRequestId: 'core-req-3',
    lastEligibility: {
      eligible: false,
      verdict: 'No elegible por préstamo activo',
      reason:
        'El socio ya tiene un préstamo vigente. Debe cancelarlo antes de solicitar uno nuevo (política SEPS/CAC).',
      maxAmountUsd: null,
      suggestedRateAnnual: null,
      estimatedMonthlyPayment: null,
      paymentToIncomeRatio: null,
    },
    ageMinutes: 1100,
    lastTouchMinutes: 920,
    lastStageReason:
      'Préstamo activo no cerrado — rechazo por política SEPS. Sugerir consolidación.',
    conversation: [
      {
        role: 'user',
        content:
          'Hola, soy Luis Chimbo. Quisiera $3500 a 24 meses para mejorar las herramientas del taller. Cédula 0405060708.',
        minutes: 1100,
      },
      {
        role: 'assistant',
        content:
          'Luis, lamentablemente tu solicitud no puede avanzar: tienes un préstamo activo en la cooperativa y debes cancelarlo antes de gestionar uno nuevo. Te recomiendo acercarte a oficina para revisar opciones de consolidación.',
        minutes: 920,
      },
    ],
  },
  {
    fullName: 'Ana Lucía Tipán Pilco',
    phone: '0978344112',
    idNumber: '0304050607',
    purpose: 'compra de moto para mototaxi',
    requestedAmount: '1200.00',
    termMonths: 18,
    currentStage: 'documentation',
    coreRequestId: null,
    lastEligibility: null,
    ageMinutes: 60,
    lastTouchMinutes: 12,
    lastStageReason: 'Solicitamos foto del rol de pagos.',
    conversation: [
      {
        role: 'user',
        content:
          'Hola, soy Ana Tipán, quiero un préstamo de $1200 a 18 meses para una moto. Soy mototaxi. Mi celular es 0978344112.',
        minutes: 60,
      },
      {
        role: 'assistant',
        content:
          'Hola Ana. Para avanzar necesito una foto de tu cédula y de tu rol de pagos. ¿Puedes enviármelos por aquí?',
        minutes: 12,
      },
    ],
  },
  {
    fullName: 'Diego Patricio Quiroga Bermeo',
    phone: '0993778821',
    idNumber: null,
    purpose: 'comprar electrodomésticos',
    requestedAmount: '800.00',
    termMonths: 12,
    currentStage: 'qualification',
    coreRequestId: null,
    lastEligibility: null,
    ageMinutes: 32,
    lastTouchMinutes: 5,
    lastStageReason: 'Confirmamos monto y plazo, falta cédula.',
    conversation: [
      {
        role: 'user',
        content:
          'Buenas, mi nombre es Diego Quiroga. Mi celular es 0993778821. Quiero saber si me pueden prestar $800 a 12 meses para comprar electrodomésticos.',
        minutes: 32,
      },
      {
        role: 'assistant',
        content:
          'Hola Diego 👋 $800 a 12 meses está dentro de los montos típicos. Para continuar, ¿me compartes tu número de cédula?',
        minutes: 5,
      },
    ],
  },
  {
    fullName: 'Verónica Estefanía Caicedo Núñez',
    phone: '0992441890',
    idNumber: null,
    purpose: null,
    requestedAmount: null,
    termMonths: null,
    currentStage: 'lead',
    coreRequestId: null,
    lastEligibility: null,
    ageMinutes: 7,
    lastTouchMinutes: 4,
    lastStageReason: 'Recién registrada.',
    conversation: [
      {
        role: 'user',
        content:
          'Hola, soy Verónica Caicedo, me dijeron que tenían préstamos rápidos.',
        minutes: 7,
      },
      {
        role: 'assistant',
        content:
          '¡Hola Verónica! Sí, te puedo ayudar 😊 ¿Cuál es tu número celular y para qué necesitas el préstamo?',
        minutes: 4,
      },
    ],
  },
  {
    fullName: 'Roberto Mauricio Galarza Tito',
    phone: '0987112233',
    idNumber: null,
    purpose: null,
    requestedAmount: null,
    termMonths: null,
    currentStage: 'lead',
    coreRequestId: null,
    lastEligibility: null,
    ageMinutes: 3,
    lastTouchMinutes: 1,
    lastStageReason: 'Primer contacto del día.',
    conversation: [
      {
        role: 'user',
        content: 'Buenas tardes, ¿qué requisitos piden para un préstamo?',
        minutes: 3,
      },
      {
        role: 'assistant',
        content:
          'Hola 👋 Te cuento: necesito tu nombre completo, tu celular y para qué quieres el préstamo. ¿Me los compartes para empezar?',
        minutes: 1,
      },
    ],
  },
  {
    fullName: 'Mónica Alexandra Llerena Cevallos',
    phone: '0998870065',
    idNumber: '0506070809',
    purpose: 'capital de trabajo (préstamo vigente)',
    requestedAmount: '1500.00',
    termMonths: 12,
    currentStage: 'servicing',
    coreRequestId: 'core-req-historic-9',
    lastEligibility: {
      eligible: true,
      verdict: 'Elegible',
      reason: 'Préstamo desembolsado y en estado activo. Cuotas al día.',
      maxAmountUsd: '1500.00',
      suggestedRateAnnual: 14,
      estimatedMonthlyPayment: '134.78',
      paymentToIncomeRatio: 0.18,
    },
    ageMinutes: 60 * 24 * 30, // 30 días
    lastTouchMinutes: 60 * 24 * 2, // hace 2 días
    lastStageReason: 'Cuota de junio cobrada al día.',
    conversation: [
      {
        role: 'user',
        content:
          'Hola, soy Mónica Llerena, quería consultar el saldo de mi préstamo.',
        minutes: 60 * 24 * 2,
      },
      {
        role: 'assistant',
        content:
          'Mónica, tu préstamo de $1500 está al día. Cuota mensual de $134.78. Próximo cobro: 5 de julio. ¿Necesitas algo más?',
        minutes: 60 * 24 * 2 - 1,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('🌱 Seeding Demo 09 — Funnel de préstamos cooperativos...');

  // 1) Industry cooperativas debe existir (la suma seed-tenants.ts).
  const industry = await prisma.industry.findUnique({
    where: { slug: COOP_INDUSTRY_SLUG },
  });
  if (!industry) {
    throw new Error(
      `Industria '${COOP_INDUSTRY_SLUG}' no existe. Corre primero: npm run db:seed:tenants`,
    );
  }

  // 2) Tenant 'demo-cooperativa' — upsert para que el seed sea idempotente.
  const tenant = await prisma.tenant.upsert({
    where: { slug: COOP_TENANT_SLUG },
    update: {
      displayName: COOP_TENANT_DISPLAY,
      industryId: industry.id,
      // Garantizar que el tenant tiene los 5 demos cooperativos habilitados
      // aunque haya sido editado manualmente. 'bi' fue agregado en el
      // sprint Demo 10 (ADR-0021).
      enabledDemos: ['loans', 'notarize', 'rag', 'agent', 'bi'],
    },
    create: {
      slug: COOP_TENANT_SLUG,
      displayName: COOP_TENANT_DISPLAY,
      industryId: industry.id,
      enabledDemos: ['loans', 'notarize', 'rag', 'agent', 'bi'],
      branding: {
        accentColor: '#0EA5E9',
        displayName: 'Cooperativa Andina',
      },
      status: 'active',
    },
  });
  console.log(`  ✓ Tenant '${COOP_TENANT_SLUG}' (id: ${tenant.id})`);

  // 3) Borrar leads previos del tenant para idempotencia. Cascade limpia
  //    LoanConversation + LoanStageHistory automáticamente.
  const deleted = await prisma.loanLead.deleteMany({
    where: { tenantId: tenant.id },
  });
  if (deleted.count > 0) {
    console.log(`  ✓ Borrados ${deleted.count} leads previos`);
  }

  // 4) Crear los 8 leads + conversación + stage history.
  for (const seed of SEED_LEADS) {
    const createdAt = offsetMinutes(seed.ageMinutes);
    const updatedAt = offsetMinutes(seed.lastTouchMinutes);

    const lead = await prisma.loanLead.create({
      data: {
        tenantId: tenant.id,
        fullName: seed.fullName,
        phone: seed.phone,
        idNumber: seed.idNumber,
        purpose: seed.purpose,
        requestedAmount:
          seed.requestedAmount !== null
            ? new Prisma.Decimal(seed.requestedAmount)
            : null,
        termMonths: seed.termMonths,
        currentStage: seed.currentStage,
        coreRequestId: seed.coreRequestId,
        lastEligibility:
          seed.lastEligibility !== null
            ? (seed.lastEligibility as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        createdAt,
        updatedAt,
      },
    });

    // Conversación
    if (seed.conversation.length > 0) {
      await prisma.loanConversation.createMany({
        data: seed.conversation.map((m) => ({
          leadId: lead.id,
          role: m.role,
          content: m.content,
          toolCall:
            m.toolCall !== undefined
              ? (m.toolCall as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          createdAt: offsetMinutes(m.minutes),
        })),
      });
    }

    // Stage history — una entrada por la transición que dejó al lead en
    // su etapa actual. Para 'lead' (etapa inicial), una sola fila con
    // fromStage=null.
    const fromStage = previousStage(seed.currentStage);
    await prisma.loanStageHistory.create({
      data: {
        leadId: lead.id,
        fromStage,
        toStage: seed.currentStage,
        movedBy: 'llm',
        reason: seed.lastStageReason,
        createdAt: updatedAt,
      },
    });
  }

  console.log(`  ✓ ${SEED_LEADS.length} leads creados`);

  console.log('✅ Seed Demo 09 completo.');
  console.log(`   Login con cualquier user del tenant '${COOP_TENANT_SLUG}'`);
  console.log(`   y entra a /demo/loans/funnel para ver el kanban poblado.`);
}

/**
 * Devuelve la etapa previa según el orden canónico del funnel. Null para
 * 'lead' (etapa inicial) y 'rejected' (terminal alternativo desde varias
 * etapas — usamos null para no asumir desde dónde vino).
 */
function previousStage(stage: LoanStage): LoanStage | null {
  const ORDER: LoanStage[] = [
    'lead',
    'qualification',
    'documentation',
    'credit_evaluation',
    'approval',
    'disbursement',
    'servicing',
  ];
  if (stage === 'rejected') return null;
  const idx = ORDER.indexOf(stage);
  if (idx <= 0) return null;
  return ORDER[idx - 1];
}

main()
  .catch((err) => {
    console.error('❌ Seed Demo 09 falló:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
