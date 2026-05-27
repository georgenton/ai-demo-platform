// ResultTable — pinta las filas devueltas por el SQL ejecutado.
// Las columnas se derivan de las keys del primer row (asumimos shape
// homogéneo, que es lo que devuelve $queryRawUnsafe).

export interface ResultTableProps {
  rows: Record<string, unknown>[];
}

export function ResultTable({ rows }: ResultTableProps) {
  if (rows.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--color-fg-muted)' }}>(empty)</p>
    );
  }
  const cols = Object.keys(rows[0]);
  return (
    <div
      style={{
        overflow: 'auto',
        borderRadius: 6,
        border: '1px solid var(--color-border-subtle)',
      }}
    >
      <table className="result-table">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td key={c}>{formatCell(row[c])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Convierte un valor de celda a string para pintar. JSON.stringify de
 * objects, "null" literal en vez de string vacío, fechas a ISO.
 */
function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
