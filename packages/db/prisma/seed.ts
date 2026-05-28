// -----------------------------------------------------------------------------
// Seed de la mini-DB académica del Demo 04.
//
// Determinismo: usamos un PRNG seedeado (mulberry32) para que cada corrida
// produzca exactamente los mismos datos. Eso permite a los tests del agente
// asumir conteos/promedios estables y a Jorge demostrar las mismas preguntas
// dos veces seguidas.
//
// Estrategia:
//   - 10 cursos fijos (códigos y nombres reales-ish).
//   - 50 estudiantes con nombres latinos y emails @example.edu.
//   - 3 términos: '2024-2', '2025-1', '2025-2'.
//   - Cada estudiante toma entre 3 y 5 cursos por término (variable).
//   - Cada inscripción lleva 3 grades (parcial-1, parcial-2, final) con
//     una correlación leve entre parciales y final (no totalmente random).
//   - Cada inscripción que tiene `final` registrado pasa a `status=completed`.
//
// Cómo correr:
//   Local:    npm run db:seed
//   Railway:  npm run db:seed:railway   (requiere `railway login` + `railway link`)
//
// El script `:railway` corre `railway run` para inyectar las variables del
// proyecto y resuelve DATABASE_URL ← DATABASE_PUBLIC_URL cuando existe
// (Railway expone la URL pública con ese nombre; la interna solo funciona
// dentro del contenedor).
//
// Idempotencia: borramos todo lo del schema académico ANTES de re-sembrar.
// No tocamos Document/Chunk — esos son del Demo 01.
// -----------------------------------------------------------------------------

import { PrismaClient } from '../generated/client/client.js';

const prisma = new PrismaClient();

/** PRNG seedeado — mulberry32. Devuelve [0, 1). Mismo seed = misma secuencia. */
function makePrng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = makePrng(20260526);

/** Entero aleatorio en [min, max] inclusive. */
function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

/** Elige n elementos distintos de un array (sin repetir). */
function sample<T>(arr: readonly T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(rand() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Catálogo de cursos
// ---------------------------------------------------------------------------

const COURSES = [
  { code: 'CALC101', name: 'Cálculo I', credits: 4 },
  { code: 'CALC201', name: 'Cálculo II', credits: 4 },
  { code: 'ALGL101', name: 'Álgebra Lineal', credits: 3 },
  { code: 'PROG101', name: 'Programación I', credits: 4 },
  { code: 'PROG201', name: 'Programación II', credits: 4 },
  { code: 'BBDD201', name: 'Bases de Datos', credits: 4 },
  { code: 'EST201', name: 'Estadística', credits: 3 },
  { code: 'FIS101', name: 'Física I', credits: 4 },
  { code: 'REDES301', name: 'Redes de Computadoras', credits: 3 },
  { code: 'IA301', name: 'Inteligencia Artificial', credits: 4 },
] as const;

// ---------------------------------------------------------------------------
// Catálogo de estudiantes (nombres latinos, emails sintéticos)
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  'Sofía',
  'Mateo',
  'Valentina',
  'Sebastián',
  'Isabella',
  'Lucas',
  'Camila',
  'Nicolás',
  'Martina',
  'Diego',
  'Emilia',
  'Joaquín',
  'Antonia',
  'Tomás',
  'Renata',
  'Benjamín',
  'Catalina',
  'Maximiliano',
  'Agustina',
  'Felipe',
  'Lucía',
  'Santiago',
  'Florencia',
  'Bruno',
  'Julieta',
];

const LAST_NAMES = [
  'García',
  'Rodríguez',
  'Martínez',
  'López',
  'González',
  'Pérez',
  'Sánchez',
  'Ramírez',
  'Torres',
  'Flores',
  'Rivera',
  'Castillo',
  'Vargas',
  'Romero',
  'Mendoza',
  'Ortiz',
  'Silva',
  'Cruz',
  'Reyes',
  'Morales',
];

const TERMS = ['2024-2', '2025-1', '2025-2'];

// ---------------------------------------------------------------------------
// Generación de grades con correlación parcial → final
// ---------------------------------------------------------------------------

/**
 * Devuelve [parcial1, parcial2, final] correlacionados. Un estudiante que va
 * bien en parciales tiende a ir bien en el final, pero con varianza realista
 * — no es solo +/- 5 puntos. Permite que aparezcan casos interesantes para
 * el agente: "aprobó parciales pero reprobó el final", etc.
 */
function generateGrades(): [number, number, number] {
  // "Capacidad" del estudiante para este curso/término (40–95). El score
  // alrededor de ese centro con ruido.
  const center = 40 + rand() * 55;
  const noise = () => (rand() - 0.5) * 30; // ruido ±15
  const clamp = (x: number) =>
    Math.round(Math.max(0, Math.min(100, x)) * 10) / 10;
  return [
    clamp(center + noise()),
    clamp(center + noise()),
    clamp(center + noise()),
  ];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('🌱 Seeding academic schema (Demo 04)...');

  // Limpieza idempotente. CASCADE borra grades y enrollments asociados.
  await prisma.grade.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.student.deleteMany();
  await prisma.course.deleteMany();

  // 1) Cursos
  const courses = await Promise.all(
    COURSES.map((c) => prisma.course.create({ data: c })),
  );
  console.log(`  ✓ ${courses.length} courses`);

  // 2) Estudiantes (50). Nombres y emails determinísticos por índice del seed.
  const students = [];
  const usedEmails = new Set<string>();
  for (let i = 0; i < 50; i++) {
    const first = FIRST_NAMES[randInt(0, FIRST_NAMES.length - 1)];
    const last = LAST_NAMES[randInt(0, LAST_NAMES.length - 1)];
    let email = `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.edu`;
    // Sin acentos en el email — sanitización mínima.
    email = email.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (usedEmails.has(email)) continue; // raro pero por las dudas
    usedEmails.add(email);

    // Matrícula al programa: fecha aleatoria entre 2022 y 2024.
    const enrolledAt = new Date(2022, randInt(0, 11), randInt(1, 28));

    const s = await prisma.student.create({
      data: { fullName: `${first} ${last}`, email, enrolledAt },
    });
    students.push(s);
  }
  console.log(`  ✓ ${students.length} students`);

  // 3) Enrollments + grades por término
  let enrollmentCount = 0;
  let gradeCount = 0;
  for (const term of TERMS) {
    for (const student of students) {
      // 3–5 cursos por término
      const n = randInt(3, 5);
      const selectedCourses = sample(courses, n);

      for (const course of selectedCourses) {
        // El enrollment empieza como `completed` si tiene final — lo seteamos
        // explícitamente. Algunos pocos (5%) los dejamos como `withdrawn`
        // (sin grades), para que aparezcan en queries del tipo "quién se
        // dio de baja".
        const dropped = rand() < 0.05;

        const enrollment = await prisma.enrollment.create({
          data: {
            studentId: student.id,
            courseId: course.id,
            term,
            status: dropped ? 'withdrawn' : 'completed',
          },
        });
        enrollmentCount++;

        if (!dropped) {
          const [p1, p2, fn] = generateGrades();
          await prisma.grade.createMany({
            data: [
              { enrollmentId: enrollment.id, examType: 'parcial_1', score: p1 },
              { enrollmentId: enrollment.id, examType: 'parcial_2', score: p2 },
              { enrollmentId: enrollment.id, examType: 'final', score: fn },
            ],
          });
          gradeCount += 3;
        }
      }
    }
  }
  console.log(`  ✓ ${enrollmentCount} enrollments`);
  console.log(`  ✓ ${gradeCount} grades`);

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
