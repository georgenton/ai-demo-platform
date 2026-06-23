// -----------------------------------------------------------------------------
// EligibilityCard — card que el bot "manda" cuando llama a
// calculate_loan_eligibility. Se renderiza como un bubble especial del
// assistant (no system message) porque es info estructurada que el socio
// va a querer leer dos veces.
// -----------------------------------------------------------------------------

'use client';

import { Icon } from '@/components/ui';
import { useT } from '@/lib/i18n';
import type { LoanEligibilityResult } from '@/lib/api';

interface Props {
  result: LoanEligibilityResult;
}

export function EligibilityCard({ result }: Props) {
  const { t } = useT();
  return (
    <div className={`loans-eligibility-card ${result.eligible ? 'ok' : 'no'}`}>
      <div className="loans-eligibility-header">
        <Icon
          name={result.eligible ? 'check-circle-2' : 'circle-x'}
          size={20}
          strokeWidth={1.8}
        />
        <span className="loans-eligibility-verdict">{result.verdict}</span>
      </div>
      <p className="loans-eligibility-reason">{result.reason}</p>
      {(result.maxAmountUsd !== null ||
        result.suggestedRateAnnual !== null ||
        result.estimatedMonthlyPayment !== null ||
        result.paymentToIncomeRatio !== null) && (
        <dl className="loans-eligibility-grid">
          {result.maxAmountUsd !== null && (
            <div className="loans-eligibility-row">
              <dt>{t('loans.eligibility.maxAmount')}</dt>
              <dd>${result.maxAmountUsd}</dd>
            </div>
          )}
          {result.suggestedRateAnnual !== null && (
            <div className="loans-eligibility-row">
              <dt>{t('loans.eligibility.rate')}</dt>
              <dd>{result.suggestedRateAnnual}%</dd>
            </div>
          )}
          {result.estimatedMonthlyPayment !== null && (
            <div className="loans-eligibility-row">
              <dt>{t('loans.eligibility.payment')}</dt>
              <dd>${result.estimatedMonthlyPayment}</dd>
            </div>
          )}
          {result.paymentToIncomeRatio !== null && (
            <div className="loans-eligibility-row">
              <dt>{t('loans.eligibility.ratio')}</dt>
              <dd>{(result.paymentToIncomeRatio * 100).toFixed(1)}%</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
