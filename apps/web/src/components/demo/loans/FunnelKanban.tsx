// -----------------------------------------------------------------------------
// FunnelKanban — el kanban del oficial. 8 columnas (las 7 etapas activas
// + rejected al final). Cada columna tiene su header con conteo y un
// stack vertical de LeadCard. Scroll horizontal si la pantalla es chica.
//
// NO permite drag-and-drop entre columnas en este sub-PR. Las
// transiciones siguen siendo responsabilidad del LLM via la tool
// move_to_stage (vista socio). El oficial solo observa el estado y
// puede abrir cada lead.
// -----------------------------------------------------------------------------

'use client';

import { useT } from '@/lib/i18n';
import type { LoanLeadListItem, LoanStage } from '@/lib/api';

import { LeadCard } from './LeadCard';

interface Props {
  leads: LoanLeadListItem[];
  selectedLeadId: string | null;
  onSelectLead: (lead: LoanLeadListItem) => void;
}

const COLUMNS: LoanStage[] = [
  'lead',
  'qualification',
  'documentation',
  'credit_evaluation',
  'approval',
  'disbursement',
  'servicing',
  'rejected',
];

export function FunnelKanban({ leads, selectedLeadId, onSelectLead }: Props) {
  const { t } = useT();
  const byStage = groupByStage(leads);

  return (
    <div className="funnel-kanban" role="region" aria-label="Kanban del funnel">
      {COLUMNS.map((stage) => {
        const items = byStage.get(stage) ?? [];
        return (
          <div key={stage} className={`funnel-kanban-column col-${stage}`}>
            <header className="funnel-kanban-column-header">
              <span className="funnel-kanban-column-title">
                {t(`loans.stage.${stage}` as 'loans.stage.lead')}
              </span>
              <span className="funnel-kanban-column-count">{items.length}</span>
            </header>
            <div className="funnel-kanban-column-body">
              {items.length === 0 ? (
                <div className="funnel-kanban-column-empty">
                  {t('funnel.column.empty')}
                </div>
              ) : (
                items.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    selected={lead.id === selectedLeadId}
                    onSelect={onSelectLead}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function groupByStage(
  leads: LoanLeadListItem[],
): Map<LoanStage, LoanLeadListItem[]> {
  const m = new Map<LoanStage, LoanLeadListItem[]>();
  for (const lead of leads) {
    const arr = m.get(lead.currentStage) ?? [];
    arr.push(lead);
    m.set(lead.currentStage, arr);
  }
  return m;
}
