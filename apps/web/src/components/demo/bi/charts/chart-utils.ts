// -----------------------------------------------------------------------------
// chart-utils — helpers compartidos entre los wrappers de Recharts.
//
//   - rowsToObjects:  convierte (columns, rows[][]) en Array<Record> que es
//                     el formato que Recharts come.
//   - SERIES_COLORS:  paleta consistente con el design system.
//   - coerceNumeric:  asegura que los valores Y son números (Postgres devuelve
//                     Decimal como string).
// -----------------------------------------------------------------------------

/** Paleta — orden importa, hasta 8 series. Mezcla brand + accent + warm. */
export const SERIES_COLORS = [
  '#0f3e6a', // brand navy
  '#43c194', // accent mint
  '#f59e0b', // amber
  '#ef4444', // rose
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f97316', // orange
] as const;

/** Convierte `(columns, rows[][])` en `Array<Record<string, unknown>>`. */
export function rowsToObjects(
  columns: string[],
  rows: unknown[][],
): Array<Record<string, unknown>> {
  return rows.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

/**
 * Postgres devuelve Decimal/Numeric como string para preservar precisión.
 * Recharts no los grafica como números — los castea a Number(). Acá hacemos
 * el cast preventivamente y devolvemos un nuevo dataset.
 */
export function coerceNumeric(
  data: Array<Record<string, unknown>>,
  numericKeys: string[],
): Array<Record<string, unknown>> {
  return data.map((row) => {
    const out: Record<string, unknown> = { ...row };
    for (const k of numericKeys) {
      const v = out[k];
      if (typeof v === 'string') {
        const n = Number(v);
        if (Number.isFinite(n)) out[k] = n;
      }
    }
    return out;
  });
}

/**
 * Formatea valores del eje X cuando son fechas ISO. Si no parece fecha,
 * devuelve el valor tal cual.
 */
export function formatAxisTick(value: unknown): string {
  if (typeof value === 'string') {
    // ISO date detectado.
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) {
        // Formato corto "YYYY-MM" cuando solo importa el mes.
        return value.length === 10 || value.includes('T00:00:00')
          ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
          : value;
      }
    }
    return value;
  }
  if (typeof value === 'number') return value.toLocaleString('es-EC');
  return String(value);
}

export function formatMetricValue(value: unknown): string {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(n)) return String(value ?? '');
  return n.toLocaleString('es-EC', {
    maximumFractionDigits: n >= 100 ? 0 : 2,
  });
}
