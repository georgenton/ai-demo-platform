import type { BiChartSpec } from './dto/bi.dto.js';

export interface CuratedBiPlan {
  id: string;
  sql: string;
  chartSpec: BiChartSpec;
}

const ACCENT_MAP: Record<string, string> = {
  á: 'a',
  é: 'e',
  í: 'i',
  ó: 'o',
  ú: 'u',
  ü: 'u',
  ñ: 'n',
};

export function getCuratedBiPlan(question: string): CuratedBiPlan | null {
  const q = normalizeQuestion(question);

  if (hasAny(q, ['mora', 'morosidad']) && hasAny(q, ['agencia', 'sucursal'])) {
    return {
      id: 'mora-por-agencia',
      sql:
        'SELECT a.nombre, ' +
        "ROUND(100.0 * COUNT(*) FILTER (WHERE p.estado IN ('vencido','castigado')) / NULLIF(COUNT(*), 0), 2) AS pct_mora, " +
        "COUNT(*) FILTER (WHERE p.estado IN ('vencido','castigado')) AS prestamos_morosos, " +
        'COUNT(*) AS total_prestamos ' +
        'FROM "BiPrestamo" p ' +
        'JOIN "BiAgencia" a ON a.id = p."agenciaId" ' +
        'GROUP BY a.nombre ' +
        'ORDER BY pct_mora DESC, prestamos_morosos DESC ' +
        'LIMIT 10',
      chartSpec: {
        chartType: 'bar',
        title: 'Mora por agencia (%)',
        recommendationReason:
          'Usé barras porque la pregunta compara agencias por nivel de mora.',
        xAxis: { key: 'nombre', label: 'Agencia' },
        yAxis: [{ key: 'pct_mora', label: 'Mora %' }],
      },
    };
  }

  if (
    hasAny(q, [
      'distribucion',
      'distribuye',
      'distribuir',
      'composicion',
      'participacion',
      'mix',
    ]) &&
    hasAny(q, ['cartera', 'prestamo', 'prestamos']) &&
    hasAny(q, ['producto', 'productos'])
  ) {
    return {
      id: 'cartera-vigente-por-producto',
      sql:
        'SELECT "productoTipo" AS producto, ' +
        'ROUND(SUM("montoUsd")::numeric, 0) AS cartera_usd ' +
        'FROM "BiPrestamo" ' +
        'WHERE "estado" = \'vigente\' ' +
        'GROUP BY "productoTipo" ' +
        'ORDER BY cartera_usd DESC',
      chartSpec: {
        chartType: 'pie',
        title: 'Cartera vigente por producto',
        recommendationReason:
          'Usé pastel porque la pregunta pide distribución de un total entre pocos productos.',
        xAxis: { key: 'producto', label: 'Producto' },
        yAxis: [{ key: 'cartera_usd', label: 'Cartera USD' }],
      },
    };
  }

  if (
    hasAny(q, ['desembolso', 'desembolsos']) &&
    hasAny(q, ['mensual', 'mes', 'meses', 'ano', 'anio', 'ultimo'])
  ) {
    return {
      id: 'desembolsos-mensuales',
      sql:
        'SELECT TO_CHAR("fechaDesembolso", \'YYYY-MM\') AS mes, ' +
        'ROUND(SUM("montoUsd")::numeric, 0) AS desembolsado_usd ' +
        'FROM "BiPrestamo" ' +
        'WHERE "fechaDesembolso" >= NOW() - INTERVAL \'12 months\' ' +
        'GROUP BY mes ' +
        'ORDER BY mes',
      chartSpec: {
        chartType: 'line',
        title: 'Desembolsos mensuales (12 meses)',
        recommendationReason:
          'Usé línea porque la pregunta pide evolución mensual y la tendencia importa más que el ranking.',
        xAxis: { key: 'mes', label: 'Mes' },
        yAxis: [{ key: 'desembolsado_usd', label: 'USD desembolsados' }],
      },
    };
  }

  if (
    hasAny(q, ['cartera', 'prestamo', 'prestamos']) &&
    hasAny(q, ['agencia', 'sucursal']) &&
    hasAny(q, ['producto', 'productos'])
  ) {
    return {
      id: 'cartera-agencia-producto',
      sql:
        'SELECT a.nombre AS agencia, p."productoTipo" AS producto, ' +
        'ROUND(SUM(p."montoUsd")::numeric, 0) AS cartera_usd ' +
        'FROM "BiPrestamo" p ' +
        'JOIN "BiAgencia" a ON a.id = p."agenciaId" ' +
        'WHERE p."estado" = \'vigente\' ' +
        'GROUP BY a.nombre, p."productoTipo" ' +
        'ORDER BY agencia, producto',
      chartSpec: {
        chartType: 'heatmap',
        title: 'Cartera vigente por agencia x producto',
        recommendationReason:
          'Usé mapa de calor porque la pregunta cruza agencias y productos, y el color permite ver concentración de cartera.',
        xAxis: { key: 'producto', label: 'Producto' },
        yAxis: [{ key: 'agencia', label: 'Agencia' }],
        zAxis: { key: 'cartera_usd', label: 'Cartera USD' },
      },
    };
  }

  return null;
}

export function summarizeCuratedBiResult(
  plan: CuratedBiPlan,
  columns: string[],
  rows: unknown[][],
): string | null {
  if (rows.length === 0) {
    return 'No encontré datos para responder esa pregunta con el corte actual del warehouse.';
  }

  const first = rowToObject(columns, rows[0]);
  switch (plan.id) {
    case 'mora-por-agencia': {
      const agencia = String(first.nombre ?? 'la primera agencia del ranking');
      const pct = formatValue(first.pct_mora, '%');
      const morosos = formatValue(first.prestamos_morosos);
      return `La agencia con mayor mora es **${agencia}** con ${pct}. En el ranking aparecen ${morosos} préstamos morosos para esa agencia; revisa el gráfico para comparar el resto de sucursales.`;
    }
    case 'cartera-vigente-por-producto': {
      const producto = String(first.producto ?? 'el producto principal');
      const cartera = formatUsd(first.cartera_usd);
      return `La cartera vigente se concentra principalmente en **${producto}**, con ${cartera}. El gráfico muestra el peso relativo de cada producto dentro del total vigente.`;
    }
    case 'desembolsos-mensuales': {
      const last = rowToObject(columns, rows[rows.length - 1]);
      const mes = String(last.mes ?? 'el último mes');
      const monto = formatUsd(last.desembolsado_usd);
      return `El último punto de la serie es **${mes}**, con ${monto} desembolsados. La línea permite ver la tendencia mensual y detectar picos o caídas estacionales.`;
    }
    case 'cartera-agencia-producto': {
      const agencia = String(first.agencia ?? 'una agencia');
      const producto = String(first.producto ?? 'un producto');
      const cartera = formatUsd(first.cartera_usd);
      return `El cruce agencia-producto ya está listo para revisar concentración de cartera. Por ejemplo, **${agencia}** en **${producto}** registra ${cartera}; el mapa de calor ayuda a identificar focos altos rápidamente.`;
    }
    default:
      return 'El análisis ya está calculado y visualizado con el gráfico recomendado para esta pregunta.';
  }
}

function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/[áéíóúüñ]/g, (ch) => ACCENT_MAP[ch] ?? ch)
    .replace(/[¿?¡!.,;:()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

function rowToObject(
  columns: string[],
  row: unknown[],
): Record<string, unknown> {
  return Object.fromEntries(
    columns.map((column, index) => [column, row[index]]),
  );
}

function formatValue(value: unknown, suffix = ''): string {
  if (value === null || value === undefined || value === '')
    return `0${suffix}`;
  const num = Number(value);
  if (!Number.isFinite(num)) return `${String(value)}${suffix}`;
  return `${new Intl.NumberFormat('es-EC', {
    maximumFractionDigits: 2,
  }).format(num)}${suffix}`;
}

function formatUsd(value: unknown): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return `USD ${String(value ?? 0)}`;
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(num);
}
