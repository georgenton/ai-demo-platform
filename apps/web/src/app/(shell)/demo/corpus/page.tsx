// Placeholder de Demo 03 — la implementación (teaser) real cae en PR 7.

'use client';

import { EmptyState } from '@/components/ui';
import { useT } from '@/lib/i18n';

export default function CorpusPlaceholder() {
  const { t } = useT();
  return (
    <div className="page">
      <EmptyState
        icon="library-big"
        title={t('demos.corpus.title')}
        body={t('demos.corpus.tagline')}
      />
    </div>
  );
}
