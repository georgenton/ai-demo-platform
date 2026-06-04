// -----------------------------------------------------------------------------
// Seed del Demo 07 — Avatar entrevistador HR (ADR-0017).
//
// Crea:
//   - Tenant especial `hr-shared` que aloja los roles (Job) seedeados.
//     Compartido por todos los tenants que prueban el demo. Cuando una
//     empresa firme contrato y quiera definir sus propios roles, su
//     tenantId apuntará a sus Job propios — el HrService resuelve cuál
//     tenant servir según el caller (mismo patrón que el clínico).
//   - 6 roles iniciales con 5-7 preguntas cada uno (= ~36 preguntas en
//     total). Roles cubren tech, comercial, admin, gerencial.
//
// Características:
//   - Determinístico: nada de Math.random ni Date.now. Cada corrida
//     produce los mismos datos.
//   - Idempotente: upsert sobre `tenant.slug='hr-shared'` y borrado +
//     recreación por job para que cambios en el seed se apliquen sin
//     conflictos por @@unique([tenantId, slug]) o @@unique([jobId, order]).
//
// Cómo correr:
//   npm run db:seed:hr           # local con .env
//   npm run db:seed:hr:railway   # contra Railway via DATABASE_PUBLIC_URL
// -----------------------------------------------------------------------------

import { PrismaClient } from '../generated/client/client.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Constantes del tenant compartido
// ---------------------------------------------------------------------------

const SHARED_TENANT_SLUG = 'hr-shared';
const SHARED_TENANT_ID = 'ctnt_hr_shared';
// El tenant compartido vive en industria 'universidad' por arbitrariedad —
// los Job son recursos del catálogo de demo, no implican que solo
// universidades puedan usar el demo. Las industrias que tienen 'interview'
// en `enabledDemos` son las que ven el demo en el sidebar (la lista la
// define seed-tenants.ts).
const SHARED_INDUSTRY_SLUG = 'universidad';

// ---------------------------------------------------------------------------
// Dataset de roles + preguntas
//
// Cada rol tiene:
//   - slug, title, description (1-2 párrafos).
//   - dimensions: array de strings con los ejes a evaluar. El LLM las usa
//     al final para emitir scoring por dimensión.
//   - questions: array ordenado de { text, rubric }. `text` es lo que el
//     avatar dice por TTS; `rubric` es input al LLM al evaluar (no se
//     muestra al candidato).
// ---------------------------------------------------------------------------

interface SeedQuestion {
  text: string;
  rubric: string;
}

interface SeedJob {
  slug: string;
  title: string;
  description: string;
  dimensions: string[];
  questions: SeedQuestion[];
}

const JOBS: SeedJob[] = [
  // -------------------------------------------------------------------------
  // 1) Desarrollador junior backend
  // -------------------------------------------------------------------------
  {
    slug: 'dev-junior-backend',
    title: 'Desarrollador junior backend',
    description:
      'Posición para una persona con 0-2 años de experiencia desarrollando APIs y servicios. Trabajará en un equipo de 3-5 personas. Stack: Node.js o Python, Postgres, Git, GitHub.',
    dimensions: [
      'claridad',
      'conocimiento técnico',
      'capacidad de aprendizaje',
      'motivación',
    ],
    questions: [
      {
        text: 'Cuéntame de un proyecto donde tuviste que aprender una tecnología nueva. ¿Cómo te organizaste?',
        rubric:
          'Buscamos: estructura ("primero leí docs, luego hice un mini-proyecto"), reconocimiento de bloqueos, uso de recursos (compañeros, documentación, ChatGPT/StackOverflow), conclusión tangible. Banderas rojas: "no me acuerdo", "no he aprendido nada nuevo recientemente".',
      },
      {
        text: 'Si te pido que expliques qué es una API REST a alguien que nunca programó, ¿cómo lo harías?',
        rubric:
          'Buscamos: analogías claras (carta a un restaurante, control remoto), no uso excesivo de jerga, identifica cliente/servidor, menciona verbos (GET/POST). Banderas rojas: definición copy-paste, no logra simplificar.',
      },
      {
        text: 'Si tu código rompe en producción a las 3 AM, ¿cuál es el primer paso que tomas?',
        rubric:
          'Buscamos: priorización (mitigar antes de diagnosticar — rollback, feature flag), comunicación al equipo, NO entrar a debuggear directo, postmortem después. Banderas rojas: "abro el código y empiezo a leer", actuar solo sin avisar.',
      },
      {
        text: '¿Qué te motivó a postularte a esta posición y qué buscas aprender en el próximo año?',
        rubric:
          'Buscamos: motivación específica vinculada a la empresa/producto, objetivos concretos de aprendizaje (no "todo"), cierta autoconciencia sobre el nivel actual. Banderas rojas: respuestas genéricas, foco solo en salario, "estoy buscando cualquier cosa".',
      },
      {
        text: '¿Tienes alguna pregunta sobre el rol, el equipo o la empresa?',
        rubric:
          'Buscamos: el candidato hizo research previo, las preguntas son sustanciales (sobre cultura del equipo, stack técnico, mentoring, oportunidades de crecimiento). Banderas rojas: "no, ninguna", preguntas solo sobre beneficios/horarios.',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 2) Desarrollador senior fullstack
  // -------------------------------------------------------------------------
  {
    slug: 'dev-senior-fullstack',
    title: 'Desarrollador senior fullstack',
    description:
      'Posición para una persona con 5+ años de experiencia desarrollando aplicaciones web completas. Mentoría a juniors, decisiones de arquitectura, code reviews. Stack: TypeScript, React, Node.js, Postgres.',
    dimensions: [
      'conocimiento técnico',
      'experiencia',
      'liderazgo técnico',
      'comunicación',
    ],
    questions: [
      {
        text: 'Cuéntame de un sistema que diseñaste de cero. ¿Cuáles fueron las decisiones de arquitectura más importantes y por qué?',
        rubric:
          'Buscamos: razonamiento sobre trade-offs (no "porque es mejor"), conciencia de restricciones (presupuesto, tiempo, equipo), capacidad de revisar la decisión en retrospectiva. Banderas rojas: "elegí X porque está de moda", no menciona constraints, no admite ningún error.',
      },
      {
        text: '¿Cómo manejas a un junior que constantemente sube código que rompe el linter o no pasa code review?',
        rubric:
          'Buscamos: balance entre acompañar y mantener estándares, identificar causa raíz (¿no sabe la herramienta? ¿no entiende el porqué de la regla?), uso de pair-programming. Banderas rojas: "lo regaño", "lo dejo así porque es junior".',
      },
      {
        text: 'Imagina que el equipo está dividido sobre adoptar una tecnología nueva (por ejemplo, cambiar de REST a GraphQL). ¿Cómo lo resuelves?',
        rubric:
          'Buscamos: facilitar discusión, pedir datos concretos (no opiniones), prototipo pequeño, decisión basada en contexto del producto. Banderas rojas: "decido yo", esperar consenso eterno, decisión basada en tweets/Hacker News.',
      },
      {
        text: 'Has migrado un sistema con cero downtime en producción. ¿Cómo lo hiciste?',
        rubric:
          'Buscamos: estrategia concreta (blue-green, feature flags, dual-write), tests E2E, plan de rollback, comunicación con stakeholders. Banderas rojas: "no he hecho una migración grande", respuesta solo teórica.',
      },
      {
        text: '¿Qué te frustra de cómo se hacen las cosas en tu empresa actual y cómo intentaste mejorarlo?',
        rubric:
          'Buscamos: madurez para identificar fricciones, intentos de mejora concretos (sin culpar), aprendizaje de qué funcionó y qué no. Banderas rojas: queja sin acción, culpa a otros, "todo está bien".',
      },
      {
        text: '¿Qué preguntas tienes sobre el equipo o el roadmap del producto?',
        rubric:
          'Buscamos: preguntas estratégicas (no solo técnicas), interés genuino en el negocio, evaluación del candidato hacia la empresa. Banderas rojas: solo preguntas sobre tech stack o salario.',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 3) Ejecutivo comercial B2B
  // -------------------------------------------------------------------------
  {
    slug: 'comercial-ventas-b2b',
    title: 'Ejecutivo comercial B2B',
    description:
      'Posición para una persona con 3+ años cerrando ventas a empresas medianas/grandes. Tickets de USD 20K-200K, ciclos de 2-6 meses. Reporta al gerente comercial.',
    dimensions: [
      'comunicación',
      'manejo de objeciones',
      'orientación a resultados',
      'cultural fit',
    ],
    questions: [
      {
        text: 'Cuéntame de la venta más difícil que cerraste. ¿Qué la hacía difícil?',
        rubric:
          'Buscamos: complejidad real (no "fue caro"), proceso estructurado (descubrimiento, validación, cierre), persistencia inteligente (no acoso), rol de los stakeholders internos del cliente. Banderas rojas: "todas son fáciles", la dificultad es solo el precio.',
      },
      {
        text: 'El cliente te dice: "el precio es muy alto". ¿Cómo respondes?',
        rubric:
          'Buscamos: NO bajar el precio inmediato, preguntar contexto ("alto comparado con qué"), reframear valor, segmentar (si bajamos precio sacamos X), saber cuándo retirarse. Banderas rojas: "le hago descuento", "le digo que sí es alto pero…".',
      },
      {
        text: '¿Cómo gestionas un pipeline de 30 oportunidades simultáneas?',
        rubric:
          'Buscamos: priorización por probabilidad x ticket x tiempo, uso de CRM consistente, momento del "next step" claro en cada cuenta, descarte temprano de leads frívolos. Banderas rojas: "le pongo cabeza a las grandes", no usa herramientas.',
      },
      {
        text: 'Un decision-maker no te responde hace 2 semanas. ¿Qué haces?',
        rubric:
          'Buscamos: secuencia inteligente (cambia canal, agrega valor en el mensaje, busca un sponsor interno alterno), NO mensaje de "¿alguna novedad?", saber cuándo cerrar el deal como perdido. Banderas rojas: insiste solo, deja morir el deal.',
      },
      {
        text: '¿Qué es para ti más importante: cerrar la cuota o construir una relación de largo plazo con el cliente?',
        rubric:
          'Buscamos: respuesta matizada (ambas, dependiendo del momento), ejemplos concretos, conciencia de que cumplir cuota y relación NO son opuestos. Banderas rojas: "la cuota a toda costa", "siempre la relación, no me importa la cuota".',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 4) Customer success
  // -------------------------------------------------------------------------
  {
    slug: 'customer-success',
    title: 'Customer success',
    description:
      'Posición para acompañar a clientes existentes después de la venta. Onboarding, adopción, renovaciones, upsells. 30-60 cuentas asignadas. Reporta al head de operaciones.',
    dimensions: [
      'empatía',
      'resolución de problemas',
      'comunicación',
      'orientación al cliente',
    ],
    questions: [
      {
        text: 'Un cliente está molesto porque el producto no funciona como esperaba. ¿Cómo manejas la primera llamada?',
        rubric:
          'Buscamos: escucha primero (no defender el producto), validar la frustración, identificar la expectativa vs la realidad, plan de acción concreto con tiempo. Banderas rojas: defender producto inmediato, prometer cosas imposibles, transferir a soporte sin entender.',
      },
      {
        text: '¿Cómo identificas tempranamente que una cuenta tiene riesgo de no renovar?',
        rubric:
          'Buscamos: combinación de señales (uso del producto, sponsor cambió, NPS bajo, falta de pagos, silencio prolongado), QBRs regulares, segmentación por health score. Banderas rojas: "espero a que avise", "todas las cuentas son iguales".',
      },
      {
        text: 'Un cliente quiere una feature que tu producto no tiene y no está en el roadmap. ¿Qué haces?',
        rubric:
          'Buscamos: entender el "para qué" detrás del pedido (job to be done), explorar workarounds existentes, escalar al PM con caso de negocio (no solo "lo pide el cliente"), comunicar transparentemente. Banderas rojas: prometer la feature, ignorar el pedido.',
      },
      {
        text: 'Cuéntame de una cuenta que recuperaste cuando ya estaba por irse. ¿Cómo lo lograste?',
        rubric:
          'Buscamos: ejemplo concreto, identificación de causa raíz (no solo el síntoma), plan estructurado, resultado medible, aprendizaje. Banderas rojas: "no se me ocurre ninguna", "le bajé el precio y se quedó".',
      },
      {
        text: '¿Qué te impulsa más: tener clientes felices o cumplir las métricas de retención del trimestre?',
        rubric:
          'Buscamos: respuesta matizada (clientes felices generan retención), honestidad sobre tensiones (a veces se contradicen), priorización clara. Banderas rojas: "siempre el cliente, las métricas no importan", "solo las métricas".',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 5) Asistente administrativa
  // -------------------------------------------------------------------------
  {
    slug: 'asistente-administrativa',
    title: 'Asistente administrativa',
    description:
      'Posición para una persona con 2+ años organizando agendas, manejando proveedores, eventos internos y reportes. Reporta al gerente general. Idealmente con manejo de inglés básico.',
    dimensions: [
      'organización',
      'comunicación',
      'manejo de presión',
      'atención al detalle',
    ],
    questions: [
      {
        text: 'El gerente tiene 5 reuniones en el día y un evento externo. ¿Cómo organizas la agenda?',
        rubric:
          'Buscamos: priorización (no todo es igual), buffers entre reuniones, contingencias (tráfico, reuniones que se alargan), coordinación con los demás participantes. Banderas rojas: "sigo el orden que me da", no piensa en logística.',
      },
      {
        text: 'Tienes que coordinar la compra de 50 laptops para un onboarding masivo. ¿Cuáles son los pasos?',
        rubric:
          'Buscamos: validar especificaciones con IT, cotizar mínimo 3 proveedores, plazos de entrega, presupuesto, plan B si un proveedor falla, seguimiento post-entrega. Banderas rojas: respuesta improvisada, "pido cotización a uno solo".',
      },
      {
        text: 'Un proveedor importante te falla el día antes de un evento corporativo grande. ¿Qué haces?',
        rubric:
          'Buscamos: calma bajo presión, plan B tangible, comunicación al jefe sin pánico, no culpar al proveedor en público, aprendizaje para la próxima. Banderas rojas: pánico, esconder el problema, culpar al proveedor frente al cliente.',
      },
      {
        text: '¿Cómo te aseguras de que un reporte mensual de 30 páginas no tenga errores antes de presentarlo?',
        rubric:
          'Buscamos: doble revisión, ojo de un tercero, checklist propio, validación de números con la fuente, separar revisión de contenido de revisión de formato. Banderas rojas: "lo reviso una vez y listo", "no he hecho un reporte así".',
      },
      {
        text: '¿Cómo manejas que el gerente te pida algo urgente cuando ya estás con otras 3 cosas urgentes?',
        rubric:
          'Buscamos: re-priorizar con el gerente (no decidir sola), comunicar el impacto en lo otro, no asumir que todo es urgente, propuesta de orden. Banderas rojas: dice "sí a todo" sin priorizar, dice "no" sin alternativa.',
      },
    ],
  },

  // -------------------------------------------------------------------------
  // 6) Gerente de operaciones
  // -------------------------------------------------------------------------
  {
    slug: 'gerente-operaciones',
    title: 'Gerente de operaciones',
    description:
      'Posición para liderar el área de operaciones de una empresa mediana (50-200 personas). Gestiona equipos de logística, compras y servicio. Reporta al gerente general.',
    dimensions: [
      'liderazgo',
      'toma de decisiones',
      'gestión de equipos',
      'visión estratégica',
    ],
    questions: [
      {
        text: 'Heredas un equipo de 25 personas con baja moral y rotación alta. ¿Cuáles son tus primeros 90 días?',
        rubric:
          'Buscamos: escucha primero (1-on-1s individuales), no cambiar nada las primeras 2-3 semanas, identificar quick wins, plan de retención de top performers, comunicación clara de la nueva dirección. Banderas rojas: cambios drásticos día 1, despedir gente sin entender.',
      },
      {
        text: 'Tienes que decidir entre invertir USD 100K en automatizar un proceso o en contratar 3 personas. ¿Cómo decides?',
        rubric:
          'Buscamos: análisis de ROI con horizonte, considerar el riesgo de cada opción, el impacto en el equipo, opciones híbridas (automatizar parcial + 1 persona), consulta con stakeholders. Banderas rojas: decisión por intuición pura, no considerar a la gente afectada.',
      },
      {
        text: 'Un líder de tu equipo no está cumpliendo con sus objetivos hace 2 trimestres. ¿Qué pasos tomas?',
        rubric:
          'Buscamos: conversación honesta tempranamente (no esperar al review formal), entender causa raíz, plan de mejora con tiempo, decisión de continuar/separar basada en evidencia. Banderas rojas: evitar la conversación, despedir sin proceso.',
      },
      {
        text: '¿Cuál es la métrica más importante que sigues semanalmente y por qué?',
        rubric:
          'Buscamos: una métrica clara con racional sólido (no "sigo varias"), vinculación al impacto en el negocio, comprensión de qué hacer si la métrica se deteriora. Banderas rojas: "sigo todas", métrica vanidad sin acción.',
      },
      {
        text: 'Si tuvieras que cortar 20% del presupuesto del próximo trimestre, ¿cómo decidirías qué cortar?',
        rubric:
          'Buscamos: criterio basado en impacto al cliente y al equipo, no cortes uniformes, proteger lo crítico, conversación con líderes de área, comunicación transparente del recorte. Banderas rojas: "corto 20% en cada cosa", decisión unilateral sin consulta.',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('👔 Seeding Demo 07 — Avatar entrevistador HR...');

  // Verificar que la industria exista.
  const industry = await prisma.industry.findUnique({
    where: { slug: SHARED_INDUSTRY_SLUG },
  });
  if (!industry) {
    throw new Error(
      `La industria '${SHARED_INDUSTRY_SLUG}' no existe. Corre primero npm run db:seed:tenants.`,
    );
  }

  // 1) Tenant compartido (idempotente con upsert por slug).
  const tenant = await prisma.tenant.upsert({
    where: { slug: SHARED_TENANT_SLUG },
    update: { displayName: 'HR · Demo compartido', industryId: industry.id },
    create: {
      id: SHARED_TENANT_ID,
      slug: SHARED_TENANT_SLUG,
      displayName: 'HR · Demo compartido',
      industryId: industry.id,
      enabledDemos: ['interview'],
      branding: {
        accentColor: '#43C194',
        displayName: 'HR Demo',
      },
      status: 'active',
    },
  });
  console.log(`  ✓ Tenant '${tenant.slug}' (id: ${tenant.id})`);

  // 2) Borrar jobs anteriores del tenant para reflejar cambios del seed.
  //    Cascada elimina questions, interviews y answers.
  await prisma.job.deleteMany({ where: { tenantId: tenant.id } });

  // 3) Crear jobs con sus preguntas en orden.
  for (const seed of JOBS) {
    await prisma.job.create({
      data: {
        tenantId: tenant.id,
        slug: seed.slug,
        title: seed.title,
        description: seed.description,
        dimensions: seed.dimensions,
        questions: {
          create: seed.questions.map((q, idx) => ({
            order: idx,
            text: q.text,
            rubric: q.rubric,
          })),
        },
      },
    });
  }

  const totalQuestions = JOBS.reduce((acc, j) => acc + j.questions.length, 0);
  console.log(
    `  ✓ ${JOBS.length} roles con ${totalQuestions} preguntas en total`,
  );

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
