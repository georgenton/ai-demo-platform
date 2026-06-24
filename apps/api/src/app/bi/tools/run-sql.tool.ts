// -----------------------------------------------------------------------------
// Tool `run_sql` — el LLM la llama con un SELECT contra el warehouse BI.
// El service ejecuta el SQL ya sanitizado y devuelve filas.
//
// El parser solo valida la SHAPE del input. La sanitización del SQL ocurre
// en `sql-safety.ts`; el ejecutor en el service.
// -----------------------------------------------------------------------------

import type { ChatTool } from '@org/llm-adapter';

export const RUN_SQL_TOOL: ChatTool = {
  name: 'run_sql',
  description:
    'Ejecuta una consulta SQL SELECT contra el warehouse de la cooperativa. ' +
    'Tablas disponibles: BiAgencia, BiSocio, BiPrestamo, BiCaptacion, BiCuota. ' +
    'SOLO SELECT (con CTE WITH permitido). NO se admite INSERT/UPDATE/DELETE/DROP. ' +
    'NO incluyas `;` (un solo statement por llamada). NO necesitas filtrar por tenantId — el backend lo inyecta forzado. ' +
    'Usa nombres de columna y tabla entre comillas dobles (ej. "BiPrestamo", "fechaDesembolso").',
  inputSchema: {
    type: 'object',
    properties: {
      sql: {
        type: 'string',
        description:
          'Consulta SELECT completa. Ejemplo: `SELECT "productoTipo", SUM("montoUsd") FROM "BiPrestamo" WHERE estado=\'vigente\' GROUP BY "productoTipo"`',
      },
    },
    required: ['sql'],
  },
};

export interface RunSqlInput {
  sql: string;
}

export function parseRunSqlInput(
  input: unknown,
): RunSqlInput | { error: string } {
  if (!input || typeof input !== 'object') {
    return { error: 'Input no es un objeto.' };
  }
  const o = input as Partial<RunSqlInput>;
  if (typeof o.sql !== 'string' || o.sql.trim().length === 0) {
    return { error: 'sql debe ser un string no vacío.' };
  }
  return { sql: o.sql.trim() };
}
