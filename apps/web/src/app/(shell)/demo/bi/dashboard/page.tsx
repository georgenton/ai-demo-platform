// -----------------------------------------------------------------------------
// /demo/bi/dashboard — grid de charts guardados del tenant.
//
// Cada DashboardCard ejecuta su SQL al montarse y renderiza el chart con
// datos frescos. Botón "Volver" lleva a /demo/bi para hacer más preguntas.
// -----------------------------------------------------------------------------

'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { Button, Eyebrow, Icon } from '@/components/ui';
import { DashboardCard } from '@/components/demo/bi/DashboardCard';
import { AudienceLine } from '@/components/shared/AudienceLine';
import { listBiDashboard } from '@/lib/api';
import type { BiDashboardItem } from '@/lib/api';
import { getDemoAudience } from '@/lib/catalog/demos';
import { useT } from '@/lib/i18n';

const DEMO_ID = 'bi' as const;

export default function DemoBiDashboardPage() {
  const { t } = useT();
  const audience = getDemoAudience(DEMO_ID, t);

  const [items, setItems] = useState<BiDashboardItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await listBiDashboard();
      setItems(list);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleRemove(id: string) {
    setItems((prev) => prev?.filter((it) => it.id !== id) ?? prev);
  }

  return (
    <div className="page bi-page">
      <div className="page-header">
        <div>
          <div className="page-title-eyebrow">{t('bi.dashboard.eyebrow')}</div>
          <h1 className="page-title">{t('bi.dashboard.title')}</h1>
          <p className="page-subtitle">{t('bi.dashboard.subtitle')}</p>
          <AudienceLine audience={audience} />
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Link href="/demo/bi">
            <Button
              variant="secondary"
              icon="message-circle-question"
              size="sm"
            >
              {t('bi.dashboard.askMore')}
            </Button>
          </Link>
        </div>
      </div>

      {items === null ? (
        <div className="bi-dashboard-page-loading">
          <Icon name="loader" size={20} />
          <span>{t('bi.dashboard.loadingList')}</span>
        </div>
      ) : error && items.length === 0 ? (
        <div className="bi-dashboard-page-error" role="alert">
          <Icon name="triangle-alert" size={18} />
          <div className="bi-dashboard-page-error-text">
            <div className="bi-dashboard-page-error-title">
              {t('bi.dashboard.errorListTitle')}
            </div>
            <div className="bi-dashboard-page-error-msg">{error}</div>
          </div>
          <Button variant="secondary" size="sm" onClick={load}>
            {t('bi.dashboard.retry')}
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="bi-empty">
          <div className="bi-empty-icon">
            <Icon name="bookmark-plus" size={42} strokeWidth={1.4} />
          </div>
          <Eyebrow>{t('bi.dashboard.empty.title')}</Eyebrow>
          <p className="bi-empty-body">{t('bi.dashboard.empty.body')}</p>
          <Link href="/demo/bi">
            <Button variant="primary" icon="message-circle-question">
              {t('bi.dashboard.askMore')}
            </Button>
          </Link>
        </div>
      ) : (
        <div className="bi-dashboard-grid">
          {items.map((item) => (
            <DashboardCard key={item.id} item={item} onRemove={handleRemove} />
          ))}
        </div>
      )}
    </div>
  );
}
