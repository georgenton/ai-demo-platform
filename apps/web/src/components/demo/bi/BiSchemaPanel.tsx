// -----------------------------------------------------------------------------
// BiSchemaPanel — sidebar con las 5 tablas del warehouse cooperativo.
//
// Por qué este panel existe:
//   En la demo en vivo el cliente ve un gráfico "salir de la nada" y
//   piensa que es magia. Mostrar las tablas + columnas detrás vende mejor
//   la propuesta: "hay un warehouse, el LLM tradujo tu pregunta a SQL real
//   sobre estas tablas, los datos no salen de ChatGPT".
//
// Diseño:
//   - Lista colapsable: nombre de la tabla + descripción corta + lista de
//     columnas más relevantes (no todas, las que importan para el demo).
//   - Cuando la última query usó una tabla, se resalta con accent y un
//     check icon. El highlight viene del prop `usedTables`.
//   - Todo hardcodeado en TS — el schema no cambia entre versiones del
//     demo y no vale la pena pedirlo al backend con otro endpoint.
// -----------------------------------------------------------------------------

'use client';

import { useState } from 'react';

import { Icon } from '@/components/ui';
import { useT } from '@/lib/i18n';
import type { StringKey } from '@/lib/i18n/strings';

interface TableInfo {
  name: string;
  descriptionKey: StringKey;
  columns: string[];
}

/**
 * El schema del warehouse del Demo 10. Refleja el seed `seed-bi.ts` y los
 * modelos Prisma `BiAgencia`, `BiSocio`, `BiPrestamo`, `BiCaptacion`,
 * `BiCuota`. Mostramos las columnas más representativas — no las 25 del
 * modelo, solo las útiles para vender la demo.
 */
const TABLES: ReadonlyArray<TableInfo> = [
  {
    name: 'BiAgencia',
    descriptionKey: 'bi.schema.agencia.desc',
    columns: ['id', 'nombre', 'provincia', 'ciudad', 'fechaApertura'],
  },
  {
    name: 'BiSocio',
    descriptionKey: 'bi.schema.socio.desc',
    columns: [
      'id',
      'cedula',
      'edad',
      'genero',
      'ingresoMensualUsd',
      'segmento',
      'agenciaId',
    ],
  },
  {
    name: 'BiPrestamo',
    descriptionKey: 'bi.schema.prestamo.desc',
    columns: [
      'id',
      'socioId',
      'agenciaId',
      'monto',
      'producto',
      'tasaAnual',
      'plazoMeses',
      'diasMora',
      'estado',
    ],
  },
  {
    name: 'BiCaptacion',
    descriptionKey: 'bi.schema.captacion.desc',
    columns: [
      'id',
      'socioId',
      'agenciaId',
      'tipo',
      'saldo',
      'tasaAnual',
      'fechaApertura',
    ],
  },
  {
    name: 'BiCuota',
    descriptionKey: 'bi.schema.cuota.desc',
    columns: [
      'id',
      'prestamoId',
      'numero',
      'monto',
      'fechaVencimiento',
      'fechaPago',
      'diasMora',
    ],
  },
];

interface BiSchemaPanelProps {
  /** Tablas usadas en la última query — vienen del SSE event `sql`. */
  usedTables: ReadonlySet<string>;
}

export function BiSchemaPanel({ usedTables }: BiSchemaPanelProps) {
  const { t } = useT();
  // Por default todas expandidas — en la demo en vivo el cliente quiere
  // verlas todas. Si el panel se vuelve muy alto, el sidebar tiene
  // overflow:auto y scrollea.
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(TABLES.map((t) => t.name)),
  );

  function toggle(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <aside className="bi-schema-panel" aria-label={t('bi.schema.title')}>
      <header className="bi-schema-head">
        <Icon name="database" size={16} strokeWidth={1.8} />
        <span>{t('bi.schema.title')}</span>
      </header>
      <p className="bi-schema-hint">{t('bi.schema.hint')}</p>
      <ul className="bi-schema-list">
        {TABLES.map((table) => {
          const isUsed = usedTables.has(table.name);
          const isOpen = expanded.has(table.name);
          return (
            <li
              key={table.name}
              className={`bi-schema-table ${isUsed ? 'used' : ''}`}
            >
              <button
                type="button"
                className="bi-schema-table-head"
                onClick={() => toggle(table.name)}
                aria-expanded={isOpen}
              >
                <Icon
                  name={isOpen ? 'chevron-down' : 'chevron-right'}
                  size={14}
                />
                <span className="bi-schema-table-name">{table.name}</span>
                {isUsed && (
                  <span
                    className="bi-schema-used-badge"
                    title={t('bi.schema.usedNow')}
                  >
                    <Icon name="check" size={11} strokeWidth={2.5} />
                  </span>
                )}
              </button>
              {isOpen && (
                <>
                  <div className="bi-schema-table-desc">
                    {t(table.descriptionKey)}
                  </div>
                  <ul className="bi-schema-cols">
                    {table.columns.map((col) => (
                      <li key={col} className="bi-schema-col">
                        {col}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
