// -----------------------------------------------------------------------------
// LeadDetailDrawer — panel lateral con el detalle de un lead seleccionado.
// Carga el LoanLeadDto completo via getLoan() (que trae también el último
// análisis crediticio si existe). Se cierra con click en backdrop o ESC.
// -----------------------------------------------------------------------------

'use client';

import { useEffect, useState } from 'react';

import { Button, Icon } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { getLoan } from '@/lib/api';
import type { LoanLeadDto, LoanLeadListItem } from '@/lib/api';

import { EligibilityCard } from './EligibilityCard';
import { StageBadge } from './StageBadge';

interface Props {
  /** Item del kanban seleccionado, o null si está cerrado. */
  selected: LoanLeadListItem | null;
  onClose: () => void;
}

export function LeadDetailDrawer({ selected, onClose }: Props) {
  const { t } = useT();
  const [lead, setLead] = useState<LoanLeadDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) {
      setLead(null);
      setError(null);
      return;
    }
    let cancelled = false;
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    getLoan(selected.id, ac.signal)
      .then((data) => {
        if (cancelled) return;
        setLead(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled || ac.signal.aborted) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [selected]);

  // ESC para cerrar.
  useEffect(() => {
    if (!selected) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, onClose]);

  if (!selected) return null;

  return (
    <>
      <div
        className="funnel-drawer-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="funnel-drawer"
        role="dialog"
        aria-label={`Detalle del lead ${selected.fullName || 'sin nombre'}`}
      >
        <header className="funnel-drawer-header">
          <div>
            <div className="funnel-drawer-title">
              {selected.fullName || '(sin nombre)'}
            </div>
            <div className="funnel-drawer-phone">{selected.phone || '—'}</div>
          </div>
          <button
            type="button"
            className="funnel-drawer-close"
            onClick={onClose}
            aria-label={t('funnel.drawer.close')}
          >
            <Icon name="x" size={18} />
          </button>
        </header>

        {loading && (
          <div className="funnel-drawer-loading">
            <Icon name="loader" size={20} />
            <span>{t('funnel.drawer.loading')}</span>
          </div>
        )}

        {error && (
          <div className="funnel-drawer-error" role="alert">
            <Icon name="triangle-alert" size={18} />
            <span>{error}</span>
          </div>
        )}

        {lead && !loading && !error && (
          <div className="funnel-drawer-body">
            {/* Etapa actual */}
            <section className="funnel-drawer-section">
              <div className="funnel-drawer-section-title">
                {t('funnel.drawer.stage')}
              </div>
              <StageBadge stage={lead.currentStage} />
            </section>

            {/* Datos del socio */}
            <section className="funnel-drawer-section">
              <div className="funnel-drawer-section-title">
                {t('funnel.drawer.memberData')}
              </div>
              <dl className="funnel-drawer-list">
                <Row
                  label={t('funnel.drawer.idNumber')}
                  value={lead.idNumber}
                />
                <Row label={t('funnel.drawer.purpose')} value={lead.purpose} />
              </dl>
            </section>

            {/* Solicitud */}
            <section className="funnel-drawer-section">
              <div className="funnel-drawer-section-title">
                {t('funnel.drawer.request')}
              </div>
              <dl className="funnel-drawer-list">
                <Row
                  label={t('funnel.drawer.amount')}
                  value={
                    lead.requestedAmount ? `$${lead.requestedAmount}` : null
                  }
                />
                <Row
                  label={t('funnel.drawer.term')}
                  value={
                    lead.termMonths
                      ? t('funnel.drawer.months', {
                          n: String(lead.termMonths),
                        })
                      : null
                  }
                />
                <Row
                  label={t('funnel.drawer.coreRequestId')}
                  value={lead.coreRequestId}
                />
              </dl>
            </section>

            {/* Análisis */}
            {lead.lastEligibility && (
              <section className="funnel-drawer-section">
                <div className="funnel-drawer-section-title">
                  {t('funnel.drawer.lastAnalysis')}
                </div>
                <EligibilityCard result={lead.lastEligibility} />
              </section>
            )}

            <Button
              variant="secondary"
              icon="message-circle"
              onClick={() => onClose()}
            >
              {t('funnel.drawer.closeAction')}
            </Button>
          </div>
        )}
      </aside>
    </>
  );
}

interface RowProps {
  label: string;
  value: string | null;
}

function Row({ label, value }: RowProps) {
  return (
    <div className="funnel-drawer-row">
      <dt>{label}</dt>
      <dd>{value || '—'}</dd>
    </div>
  );
}
