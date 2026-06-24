// -----------------------------------------------------------------------------
// Seed del Demo 10 — Warehouse mock para BI dinámico (ADR-0021, sub-PR 1).
//
// Sin este seed el LLM no tiene qué consultar. Sembramos un dataset coherente
// con los indicadores típicos de una CAC ecuatoriana mediana:
//
//   - 10 agencias                 (BiAgencia)
//   - 1000 socios                 (BiSocio)
//   - 2500 préstamos              (BiPrestamo)
//   - 1500 captaciones            (BiCaptacion)
//   - ~15000 cuotas               (BiCuota)  (~6 cuotas promedio por préstamo)
//
// Características:
//   - DETERMINÍSTICO: usamos un PRNG con seed fijo, NUNCA Math.random ni
//     Date.now. Cada corrida produce los mismos IDs y datos.
//   - IDEMPOTENTE: limpia toda la data BI del tenant antes de recrear.
//     Las cascadas borran cuotas y captaciones automáticamente.
//   - REALISTA: mora correlacionada con ingreso y tipo de producto;
//     distribución por provincia que refleja Ecuador (Pichincha + Guayas
//     concentran el 45%). Edad ponderada hacia 25-50 años.
//
// Cómo correr:
//   npm run db:seed:bi           # local
//   npm run db:seed:bi:railway   # contra Railway
// -----------------------------------------------------------------------------

import { Prisma, PrismaClient } from '../generated/client/client.js';

const prisma = new PrismaClient();

const COOP_TENANT_SLUG = 'demo-cooperativa';

// Fecha base — "hoy" para el dataset. Hace que los cálculos de mora,
// días de atraso y vencimientos sean determinísticos.
const BASE_DATE = new Date('2026-06-24T00:00:00Z');

// -----------------------------------------------------------------------------
// PRNG determinístico — mulberry32
//
// Lo necesitamos porque seed sin random no nos permite generar 1000 socios
// distintos sin escribirlos a mano. Y Math.random() rompe determinismo.
// -----------------------------------------------------------------------------

function makeRng(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: ReadonlyArray<T>): T {
  return arr[Math.floor(rng() * arr.length)] as T;
}

function pickWeighted<T>(
  rng: () => number,
  weighted: ReadonlyArray<readonly [T, number]>,
): T {
  const total = weighted.reduce((acc, [, w]) => acc + w, 0);
  let r = rng() * total;
  for (const [item, w] of weighted) {
    r -= w;
    if (r <= 0) return item;
  }
  return weighted[weighted.length - 1][0];
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randDate(
  rng: () => number,
  fromDaysAgo: number,
  toDaysAgo: number,
): Date {
  const days = randInt(rng, toDaysAgo, fromDaysAgo);
  return new Date(BASE_DATE.getTime() - days * 86_400_000);
}

function addMonths(d: Date, months: number): Date {
  const result = new Date(d);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

function diffDays(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}

function dec(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n.toFixed(2));
}

// -----------------------------------------------------------------------------
// Datasets de referencia
// -----------------------------------------------------------------------------

const AGENCIAS_DATA: ReadonlyArray<{
  codigo: string;
  nombre: string;
  ciudad: string;
  provincia: string;
  yearsOld: number;
}> = [
  {
    codigo: 'AG-001',
    nombre: 'Agencia Quito Centro',
    ciudad: 'Quito',
    provincia: 'Pichincha',
    yearsOld: 18,
  },
  {
    codigo: 'AG-002',
    nombre: 'Agencia Quito Sur',
    ciudad: 'Quito',
    provincia: 'Pichincha',
    yearsOld: 12,
  },
  {
    codigo: 'AG-003',
    nombre: 'Agencia Guayaquil Norte',
    ciudad: 'Guayaquil',
    provincia: 'Guayas',
    yearsOld: 15,
  },
  {
    codigo: 'AG-004',
    nombre: 'Agencia Cuenca',
    ciudad: 'Cuenca',
    provincia: 'Azuay',
    yearsOld: 14,
  },
  {
    codigo: 'AG-005',
    nombre: 'Agencia Ambato',
    ciudad: 'Ambato',
    provincia: 'Tungurahua',
    yearsOld: 10,
  },
  {
    codigo: 'AG-006',
    nombre: 'Agencia Loja',
    ciudad: 'Loja',
    provincia: 'Loja',
    yearsOld: 8,
  },
  {
    codigo: 'AG-007',
    nombre: 'Agencia Ibarra',
    ciudad: 'Ibarra',
    provincia: 'Imbabura',
    yearsOld: 6,
  },
  {
    codigo: 'AG-008',
    nombre: 'Agencia Machala',
    ciudad: 'Machala',
    provincia: 'El Oro',
    yearsOld: 5,
  },
  {
    codigo: 'AG-009',
    nombre: 'Agencia Riobamba',
    ciudad: 'Riobamba',
    provincia: 'Chimborazo',
    yearsOld: 4,
  },
  {
    codigo: 'AG-010',
    nombre: 'Agencia Portoviejo',
    ciudad: 'Portoviejo',
    provincia: 'Manabí',
    yearsOld: 3,
  },
];

// Pesos por agencia para distribuir socios (refleja tamaño de plaza).
const AGENCIA_WEIGHTS: ReadonlyArray<readonly [number, number]> = [
  [0, 18],
  [1, 12],
  [2, 16],
  [3, 11],
  [4, 9],
  [5, 7],
  [6, 7],
  [7, 8],
  [8, 6],
  [9, 6],
];

const OCUPACIONES: ReadonlyArray<readonly [string, number]> = [
  ['empleado', 35],
  ['comerciante', 25],
  ['agricultor', 12],
  ['profesional', 10],
  ['emprendedor', 8],
  ['estudiante', 5],
  ['jubilado', 5],
];

const SEXOS: ReadonlyArray<readonly [string, number]> = [
  ['F', 52],
  ['M', 47],
  ['X', 1],
];

const PRODUCTOS_PRESTAMO: ReadonlyArray<readonly [string, number]> = [
  ['consumo', 40],
  ['microempresa', 28],
  ['vivienda', 15],
  ['auto', 12],
  ['educacion', 5],
];

const PRODUCTOS_CAPTACION: ReadonlyArray<readonly [string, number]> = [
  ['ahorro_vista', 50],
  ['plazo_fijo', 30],
  ['ahorro_programado', 15],
  ['ahorro_navideno', 5],
];

// Tasas anuales típicas en CACs ecuatorianas por tipo de producto.
const TASAS_POR_PRODUCTO: Record<string, [number, number]> = {
  consumo: [15.5, 17.5],
  microempresa: [18.0, 22.0],
  vivienda: [10.5, 12.5],
  auto: [13.5, 15.5],
  educacion: [11.0, 13.0],
};

const ESTADOS_PRESTAMO: ReadonlyArray<readonly [string, number]> = [
  ['vigente', 62],
  ['cancelado', 25],
  ['vencido', 10],
  ['castigado', 3],
];

// -----------------------------------------------------------------------------
// Generadores
// -----------------------------------------------------------------------------

function montoPrestamoPorProducto(rng: () => number, tipo: string): number {
  switch (tipo) {
    case 'vivienda':
      return randInt(rng, 15000, 80000);
    case 'auto':
      return randInt(rng, 5000, 25000);
    case 'microempresa':
      return randInt(rng, 1500, 15000);
    case 'consumo':
      return randInt(rng, 500, 5000);
    case 'educacion':
      return randInt(rng, 800, 6000);
    default:
      return randInt(rng, 500, 3000);
  }
}

function plazoPorProducto(rng: () => number, tipo: string): number {
  switch (tipo) {
    case 'vivienda':
      return pick(rng, [60, 84, 120, 180, 240]);
    case 'auto':
      return pick(rng, [24, 36, 48, 60]);
    case 'microempresa':
      return pick(rng, [12, 18, 24, 36]);
    case 'consumo':
      return pick(rng, [6, 12, 18, 24]);
    case 'educacion':
      return pick(rng, [12, 24, 36]);
    default:
      return pick(rng, [12, 24]);
  }
}

function montoCaptacionPorProducto(rng: () => number, tipo: string): number {
  switch (tipo) {
    case 'plazo_fijo':
      return randInt(rng, 1000, 30000);
    case 'ahorro_navideno':
      return randInt(rng, 200, 2000);
    case 'ahorro_programado':
      return randInt(rng, 50, 1500);
    case 'ahorro_vista':
      return randInt(rng, 10, 8000);
    default:
      return randInt(rng, 100, 5000);
  }
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main() {
  console.log('🌱 Seeding Demo 10 — Warehouse BI de cooperativa...');

  const tenant = await prisma.tenant.findUnique({
    where: { slug: COOP_TENANT_SLUG },
  });
  if (!tenant) {
    throw new Error(
      `Tenant '${COOP_TENANT_SLUG}' no existe. Corre primero: npm run db:seed:loans`,
    );
  }

  // Limpiar data BI previa del tenant. Cascade limpia BiCuota desde
  // BiPrestamo y BiCaptacion desde BiSocio. Hacemos los deletes en orden
  // explícito por claridad.
  const deletes = await prisma.$transaction([
    prisma.biCuota.deleteMany({ where: { tenantId: tenant.id } }),
    prisma.biCaptacion.deleteMany({ where: { tenantId: tenant.id } }),
    prisma.biPrestamo.deleteMany({ where: { tenantId: tenant.id } }),
    prisma.biSocio.deleteMany({ where: { tenantId: tenant.id } }),
    prisma.biAgencia.deleteMany({ where: { tenantId: tenant.id } }),
  ]);
  const totalDeleted = deletes.reduce((a, r) => a + r.count, 0);
  if (totalDeleted > 0) {
    console.log(`  ✓ Limpiados ${totalDeleted} registros BI previos`);
  }

  // ---- AGENCIAS ----
  const agenciaIds: string[] = [];
  for (const ag of AGENCIAS_DATA) {
    const created = await prisma.biAgencia.create({
      data: {
        tenantId: tenant.id,
        codigo: ag.codigo,
        nombre: ag.nombre,
        ciudad: ag.ciudad,
        provincia: ag.provincia,
        fechaApertura: new Date(
          BASE_DATE.getTime() - ag.yearsOld * 365 * 86_400_000,
        ),
      },
    });
    agenciaIds.push(created.id);
  }
  console.log(`  ✓ ${AGENCIAS_DATA.length} agencias`);

  // ---- SOCIOS ----
  const NUM_SOCIOS = 1000;
  const rngSocios = makeRng(42);
  const socioIds: string[] = [];
  const socioToAgencia = new Map<string, string>();
  const socioIngreso = new Map<string, number>();
  const sociosToCreate: Prisma.BiSocioCreateManyInput[] = [];

  for (let i = 0; i < NUM_SOCIOS; i++) {
    const agenciaIdx = pickWeighted(rngSocios, AGENCIA_WEIGHTS);
    const agenciaId = agenciaIds[agenciaIdx];
    const edad = randInt(rngSocios, 22, 70);
    const ocupacion = pickWeighted(rngSocios, OCUPACIONES);
    const sexo = pickWeighted(rngSocios, SEXOS);
    // Ingreso correlacionado con ocupación y un poco con edad.
    const ingresoBase: Record<string, [number, number]> = {
      empleado: [600, 2200],
      comerciante: [800, 4000],
      profesional: [1500, 6000],
      emprendedor: [700, 5000],
      agricultor: [400, 1500],
      estudiante: [300, 800],
      jubilado: [450, 1200],
    };
    const [lo, hi] = ingresoBase[ocupacion] ?? [500, 2000];
    const ingreso = randInt(rngSocios, lo, hi);
    const fechaIngreso = randDate(rngSocios, 365 * 8, 30);

    sociosToCreate.push({
      tenantId: tenant.id,
      agenciaId,
      fechaIngreso,
      edad,
      sexo,
      ocupacion,
      ingresoMensualUsd: dec(ingreso),
    });
  }
  // Bulk insert para velocidad.
  await prisma.biSocio.createMany({ data: sociosToCreate });
  const sociosCreados = await prisma.biSocio.findMany({
    where: { tenantId: tenant.id },
    select: {
      id: true,
      agenciaId: true,
      ingresoMensualUsd: true,
      ocupacion: true,
    },
  });
  for (const s of sociosCreados) {
    socioIds.push(s.id);
    socioToAgencia.set(s.id, s.agenciaId);
    socioIngreso.set(s.id, Number(s.ingresoMensualUsd));
  }
  console.log(`  ✓ ${socioIds.length} socios`);

  // ---- PRÉSTAMOS ----
  const NUM_PRESTAMOS = 2500;
  const rngPrestamos = makeRng(101);
  const prestamosToCreate: Prisma.BiPrestamoCreateManyInput[] = [];
  const prestamoCronograma: Array<{
    indexInBatch: number;
    monto: number;
    plazo: number;
    tasa: number;
    fechaDesembolso: Date;
    estado: string;
    diasMora: number;
  }> = [];

  for (let i = 0; i < NUM_PRESTAMOS; i++) {
    const socioId = pick(rngPrestamos, socioIds);
    const agenciaId = socioToAgencia.get(socioId)!;
    const productoTipo = pickWeighted(rngPrestamos, PRODUCTOS_PRESTAMO);
    const monto = montoPrestamoPorProducto(rngPrestamos, productoTipo);
    const plazo = plazoPorProducto(rngPrestamos, productoTipo);
    const [tasaMin, tasaMax] = TASAS_POR_PRODUCTO[productoTipo] ?? [14, 18];
    const tasa = +(tasaMin + rngPrestamos() * (tasaMax - tasaMin)).toFixed(2);

    // Desembolso entre hoy y 4 años atrás. Préstamos viejos tienden a
    // estar cancelados; los recientes vigentes.
    const fechaDesembolso = randDate(rngPrestamos, 4 * 365, 1);
    const mesesDesdeDesembolso = Math.floor(
      diffDays(BASE_DATE, fechaDesembolso) / 30,
    );

    // Estado correlacionado con tiempo + algo de azar.
    let estado: string;
    if (mesesDesdeDesembolso >= plazo) {
      // Vencido en cronograma — la mayoría cancelados, algunos castigados.
      estado = pickWeighted(rngPrestamos, [
        ['cancelado', 80],
        ['castigado', 8],
        ['vencido', 12],
      ] as const);
    } else if (mesesDesdeDesembolso < 3) {
      estado = 'vigente';
    } else {
      estado = pickWeighted(rngPrestamos, ESTADOS_PRESTAMO);
    }

    // Cancelación: para estado='cancelado' poner fecha entre desembolso
    // y BASE_DATE.
    let fechaCancelacion: Date | null = null;
    if (estado === 'cancelado') {
      const minDays = randInt(rngPrestamos, 30, plazo * 30);
      const candidate = new Date(
        fechaDesembolso.getTime() + minDays * 86_400_000,
      );
      fechaCancelacion = candidate > BASE_DATE ? BASE_DATE : candidate;
    }

    // Días de mora — solo para vigentes/vencidos/castigados.
    let diasMora = 0;
    if (estado === 'vencido') diasMora = randInt(rngPrestamos, 31, 90);
    else if (estado === 'castigado') diasMora = randInt(rngPrestamos, 180, 720);
    else if (estado === 'vigente' && rngPrestamos() < 0.12) {
      // 12% de vigentes tiene mora <= 30d (alerta temprana).
      diasMora = randInt(rngPrestamos, 1, 30);
    }

    prestamosToCreate.push({
      tenantId: tenant.id,
      socioId,
      agenciaId,
      productoTipo,
      montoUsd: dec(monto),
      plazoMeses: plazo,
      tasaAnual: dec(tasa),
      fechaDesembolso,
      fechaCancelacion,
      estado,
      diasMora,
    });
    prestamoCronograma.push({
      indexInBatch: i,
      monto,
      plazo,
      tasa,
      fechaDesembolso,
      estado,
      diasMora,
    });
  }
  await prisma.biPrestamo.createMany({ data: prestamosToCreate });
  const prestamosCreados = await prisma.biPrestamo.findMany({
    where: { tenantId: tenant.id },
    select: {
      id: true,
      fechaDesembolso: true,
      estado: true,
      diasMora: true,
      plazoMeses: true,
      montoUsd: true,
      tasaAnual: true,
    },
    orderBy: { fechaDesembolso: 'asc' },
  });
  console.log(`  ✓ ${prestamosCreados.length} préstamos`);

  // ---- CUOTAS ----
  // Solo generamos cronograma para los últimos 12 meses de cada préstamo
  // (suficiente para queries de mora y proyección sin explotar a 200K filas).
  const rngCuotas = makeRng(7);
  const cuotasToCreate: Prisma.BiCuotaCreateManyInput[] = [];

  for (const p of prestamosCreados) {
    const monto = Number(p.montoUsd);
    const tasaAnual = Number(p.tasaAnual);
    const r = tasaAnual / 100 / 12;
    const cuotaMensual =
      r === 0
        ? monto / p.plazoMeses
        : (monto * r) / (1 - Math.pow(1 + r, -p.plazoMeses));

    // Generar cuotas: empezamos en mes 1 desde fechaDesembolso hasta
    // min(plazoMeses, mesesYaPasados). Solo últimas 12 cuotas para
    // mantener el dataset acotado.
    const mesesPasados = Math.floor(
      diffDays(BASE_DATE, p.fechaDesembolso) / 30,
    );
    const cuotasMax = Math.min(p.plazoMeses, mesesPasados);
    const desde = Math.max(1, cuotasMax - 11);

    for (let n = desde; n <= cuotasMax; n++) {
      const fechaProgramada = addMonths(p.fechaDesembolso, n);
      const fueProgramadaEnElPasado = fechaProgramada <= BASE_DATE;
      let estado: string;
      let fechaPago: Date | null = null;
      let diasAtraso = 0;

      if (!fueProgramadaEnElPasado) {
        estado = 'pendiente';
      } else if (p.estado === 'cancelado') {
        estado = 'pagada';
        const adelantoDias = randInt(rngCuotas, -3, 5);
        fechaPago = new Date(
          fechaProgramada.getTime() + adelantoDias * 86_400_000,
        );
      } else if (p.estado === 'castigado' && rngCuotas() < 0.7) {
        estado = 'vencida';
        diasAtraso = randInt(rngCuotas, 90, p.diasMora || 360);
      } else if (p.estado === 'vencido' && rngCuotas() < 0.85) {
        estado = 'vencida';
        diasAtraso = Math.min(
          p.diasMora,
          randInt(rngCuotas, 30, p.diasMora || 60),
        );
      } else {
        // Vigentes — la mayoría pagada al día.
        const diasOffset = randInt(rngCuotas, -5, 4);
        const candidate = new Date(
          fechaProgramada.getTime() + diasOffset * 86_400_000,
        );
        if (candidate <= BASE_DATE) {
          estado = 'pagada';
          fechaPago = candidate;
          if (diasOffset > 0) diasAtraso = diasOffset;
        } else {
          estado = 'pendiente';
        }
      }

      cuotasToCreate.push({
        tenantId: tenant.id,
        prestamoId: p.id,
        numero: n,
        fechaProgramada,
        fechaPago,
        montoUsd: dec(cuotaMensual),
        estado,
        diasAtraso,
      });
    }
  }
  // Insert en chunks para no saturar.
  const CHUNK = 2000;
  for (let i = 0; i < cuotasToCreate.length; i += CHUNK) {
    await prisma.biCuota.createMany({
      data: cuotasToCreate.slice(i, i + CHUNK),
    });
  }
  console.log(`  ✓ ${cuotasToCreate.length} cuotas`);

  // ---- CAPTACIONES ----
  const NUM_CAPTACIONES = 1500;
  const rngCap = makeRng(31);
  const captacionesToCreate: Prisma.BiCaptacionCreateManyInput[] = [];

  for (let i = 0; i < NUM_CAPTACIONES; i++) {
    const socioId = pick(rngCap, socioIds);
    const agenciaId = socioToAgencia.get(socioId)!;
    const productoTipo = pickWeighted(rngCap, PRODUCTOS_CAPTACION);
    const saldo = montoCaptacionPorProducto(rngCap, productoTipo);
    const fechaApertura = randDate(rngCap, 3 * 365, 30);
    const estado = rngCap() < 0.82 ? 'activa' : 'cerrada';
    const fechaCierre =
      estado === 'cerrada'
        ? new Date(
            fechaApertura.getTime() + randInt(rngCap, 60, 730) * 86_400_000,
          )
        : null;

    captacionesToCreate.push({
      tenantId: tenant.id,
      socioId,
      agenciaId,
      productoTipo,
      saldoUsd: dec(estado === 'cerrada' ? 0 : saldo),
      fechaApertura,
      fechaCierre,
      estado,
    });
  }
  await prisma.biCaptacion.createMany({ data: captacionesToCreate });
  console.log(`  ✓ ${captacionesToCreate.length} captaciones`);

  console.log('✅ Seed Demo 10 completo.');
  console.log(
    `   Total filas: ${AGENCIAS_DATA.length + socioIds.length + prestamosCreados.length + cuotasToCreate.length + captacionesToCreate.length}`,
  );
}

main()
  .catch((err) => {
    console.error('❌ Seed Demo 10 falló:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
