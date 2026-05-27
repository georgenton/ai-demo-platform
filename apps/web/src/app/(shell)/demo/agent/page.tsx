// Placeholder de Demo 04 — la implementación real cae en PR 6.

'use client';

import { EmptyState } from '@/components/ui';
import { useT } from '@/lib/i18n';

export default function AgentPlaceholder() {
  const { t } = useT();
  return (
    <div className="page">
      <EmptyState
        icon="bot"
        title={t('demos.agent.title')}
        body={t('demos.agent.tagline')}
      />
    </div>
  );
}
