// -----------------------------------------------------------------------------
// SqlBlock — bloque colapsable con el SQL ejecutado (después de safety) +
// la lista de tablas tocadas. Para que el usuario pueda auditar lo que el
// LLM corrió, copiar/pegar y entender el "modelo semántico" emergente.
// -----------------------------------------------------------------------------

'use client';

import { Icon } from '@/components/ui';
import { useT } from '@/lib/i18n';

interface Props {
  sql: string;
  tablesUsed: string[];
}

export function SqlBlock({ sql, tablesUsed }: Props) {
  const { t } = useT();
  return (
    <details className="bi-sql-block">
      <summary className="bi-sql-summary">
        <Icon name="terminal" size={14} />
        <span className="bi-sql-title">{t('bi.sqlBlock.title')}</span>
        <span className="bi-sql-expand">{t('bi.sqlBlock.expand')}</span>
      </summary>
      <div className="bi-sql-body">
        <pre className="bi-sql-pre">
          <code>{sql}</code>
        </pre>
        {tablesUsed.length > 0 && (
          <div className="bi-sql-tables">
            <span className="bi-sql-tables-label">
              {t('bi.sqlBlock.tables')}:
            </span>
            {tablesUsed.map((tbl) => (
              <code key={tbl} className="bi-sql-tag">
                {tbl}
              </code>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
