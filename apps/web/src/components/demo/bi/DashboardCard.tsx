// -----------------------------------------------------------------------------
// DashboardCard — tarjeta de un item del dashboard guardado.
//
// Al montarse, llama `executeBiDashboardItem(id)` para obtener filas
// frescas. Mientras carga muestra esqueleto. En error muestra panel
// inline con botón "Reintentar".
//
// Acciones:
//   - Refrescar: re-ejecuta la query.
//   - Eliminar: confirma con prompt nativo del browser y borra.
// -----------------------------------------------------------------------------

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Button, Icon } from '@/components/ui';
import { deleteBiDashboardItem, executeBiDashboardItem } from '@/lib/api';
import type { BiDashboardItem, BiDashboardItemExecuteResult } from '@/lib/api';
import { useT } from '@/lib/i18n';

import { DynamicChart } from './DynamicChart';

interface Props {
  item: BiDashboardItem;
  onRemove: (id: string) => void;
}

type Status =
  | { kind: 'loading' }
  | {
      kind: 'ok';
      result: BiDashboardItemExecuteResult;
    }
  | { kind: 'error'; message: string };

export function DashboardCard({ item, onRemove }: Props) {
  const { t } = useT();
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [executedAt, setExecutedAt] = useState<string | null>(null);
  const acRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    acRef.current?.abort();
    const ac = new AbortController();
    acRef.current = ac;
    setStatus({ kind: 'loading' });
    try {
      const result = await executeBiDashboardItem(item.id, ac.signal);
      if (ac.signal.aborted) return;
      setStatus({ kind: 'ok', result });
      setExecutedAt(result.executedAt);
    } catch (err) {
      if (ac.signal.aborted) return;
      const message = err instanceof Error ? err.message : String(err);
      setStatus({ kind: 'error', message });
    }
  }, [item.id]);

  useEffect(() => {
    refresh();
    return () => acRef.current?.abort();
  }, [refresh]);

  async function handleDelete() {
    if (!confirm(t('bi.dashboard.deleteConfirm', { title: item.title })))
      return;
    try {
      await deleteBiDashboardItem(item.id);
      onRemove(item.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert(t('bi.dashboard.deleteError', { msg: message }));
    }
  }

  return (
    <article className="bi-dashboard-card">
      <header className="bi-dashboard-card-header">
        <div className="bi-dashboard-card-titles">
          <h3 className="bi-dashboard-card-title">{item.title}</h3>
          <p className="bi-dashboard-card-question">
            <Icon name="message-circle-question" size={12} />
            <span>{item.question}</span>
          </p>
        </div>
        <div className="bi-dashboard-card-actions">
          <button
            type="button"
            className="bi-dashboard-icon-btn"
            onClick={refresh}
            disabled={status.kind === 'loading'}
            aria-label={t('bi.dashboard.refresh')}
            title={t('bi.dashboard.refresh')}
          >
            <Icon
              name={status.kind === 'loading' ? 'loader' : 'refresh-cw'}
              size={14}
            />
          </button>
          <button
            type="button"
            className="bi-dashboard-icon-btn danger"
            onClick={handleDelete}
            aria-label={t('bi.dashboard.delete')}
            title={t('bi.dashboard.delete')}
          >
            <Icon name="trash-2" size={14} />
          </button>
        </div>
      </header>

      {status.kind === 'loading' && (
        <div className="bi-dashboard-card-skeleton">
          <Icon name="loader" size={20} />
          <span>{t('bi.dashboard.loading')}</span>
        </div>
      )}

      {status.kind === 'error' && (
        <div className="bi-dashboard-card-error" role="alert">
          <Icon name="triangle-alert" size={16} />
          <div className="bi-dashboard-card-error-text">
            <div className="bi-dashboard-card-error-title">
              {t('bi.dashboard.errorTitle')}
            </div>
            <div className="bi-dashboard-card-error-msg">{status.message}</div>
          </div>
          <Button variant="secondary" size="sm" onClick={refresh}>
            {t('bi.dashboard.retry')}
          </Button>
        </div>
      )}

      {status.kind === 'ok' && (
        <>
          <DynamicChart
            spec={item.chartSpec}
            columns={status.result.columns}
            rows={status.result.rows}
          />
          {executedAt && (
            <div className="bi-dashboard-card-footer">
              <Icon name="clock" size={12} />
              <span>
                {t('bi.dashboard.lastExecuted', {
                  time: new Date(executedAt).toLocaleTimeString(),
                })}
              </span>
            </div>
          )}
        </>
      )}
    </article>
  );
}
