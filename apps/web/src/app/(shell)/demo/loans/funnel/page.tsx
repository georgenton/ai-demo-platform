// -----------------------------------------------------------------------------
// Demo 09 — Vista oficial del funnel de préstamos (ADR-0020).
//
// Kanban con 8 columnas (lead → ... → servicing + rejected). El oficial
// observa el estado de todos los leads del tenant en tiempo (cuasi-)real.
// Click en una tarjeta abre el drawer con detalle completo + último
// análisis crediticio.
//
// Refresh: polling cada 15s (sub-PR 5 podría reemplazarlo con SSE push).
// -----------------------------------------------------------------------------

'use client';

import { useState } from 'react';

import { Button, Icon } from '@/components/ui';
import { FunnelKanban } from '@/components/demo/loans/FunnelKanban';
import { FunnelMetrics } from '@/components/demo/loans/FunnelMetrics';
import { LeadDetailDrawer } from '@/components/demo/loans/LeadDetailDrawer';
import { useFunnelData } from '@/components/demo/loans/use-funnel-data';
import { AudienceLine } from '@/components/shared/AudienceLine';
import { getDemoAudience } from '@/lib/catalog/demos';
import { useT } from '@/lib/i18n';
import type { LoanLeadListItem } from '@/lib/api';

const DEMO_ID = 'loans' as const;

export default function DemoLoansFunnelPage() {
  const { t } = useT();
  const audience = getDemoAudience(DEMO_ID, t);
  const funnel = useFunnelData();
  const [selected, setSelected] = useState<LoanLeadListItem | null>(null);

  return (
    <div className="page funnel-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title-eyebrow">{t('funnel.eyebrow')}</div>
          <h1 className="page-title">{t('funnel.title')}</h1>
          <p className="page-subtitle">{t('funnel.subtitle')}</p>
          <AudienceLine audience={audience} />
        </div>
        <div
          className="row"
          style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}
        >
          <span className="funnel-refresh-label">
            {funnel.lastUpdatedAt
              ? t('funnel.refreshedAt', {
                  time: funnel.lastUpdatedAt.toLocaleTimeString(),
                })
              : t('funnel.refreshNever')}
          </span>
          <Button
            variant="secondary"
            icon="refresh-cw"
            size="sm"
            disabled={funnel.refreshing || funnel.loading}
            onClick={() => {
              funnel.refresh();
            }}
          >
            {t('funnel.refreshNow')}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <FunnelMetrics metrics={funnel.metrics} refreshing={funnel.refreshing} />

      {/* Body */}
      {funnel.loading ? (
        <div className="funnel-loading">
          <Icon name="loader" size={28} />
          <span>{t('funnel.loading')}</span>
        </div>
      ) : funnel.error ? (
        <div className="funnel-error" role="alert">
          <div className="funnel-error-icon">
            <Icon name="triangle-alert" size={20} />
          </div>
          <div className="funnel-error-text">
            <div className="funnel-error-title">{t('funnel.error.title')}</div>
            <div className="funnel-error-msg">{funnel.error}</div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              funnel.refresh();
            }}
          >
            {t('funnel.error.retry')}
          </Button>
        </div>
      ) : funnel.leads.length === 0 ? (
        <div className="funnel-empty">
          <Icon name="users" size={32} strokeWidth={1.4} />
          <div className="funnel-empty-title">{t('funnel.empty.title')}</div>
          <p className="funnel-empty-body">{t('funnel.empty.body')}</p>
        </div>
      ) : (
        <FunnelKanban
          leads={funnel.leads}
          selectedLeadId={selected?.id ?? null}
          onSelectLead={setSelected}
        />
      )}

      {/* Drawer con detalle */}
      <LeadDetailDrawer selected={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
