// Placeholder de Demo 02 — la implementación real cae en PR 7.
// Existe para que el link del sidebar no devuelva 404 mientras la cadena
// de PRs se completa.

'use client';

import { EmptyState } from '@/components/ui';
import { useT } from '@/lib/i18n';

export default function ComparatorPlaceholder() {
  const { t } = useT();
  return (
    <div className="page">
      <EmptyState
        icon="git-compare-arrows"
        title={t('demos.comparator.title')}
        body={t('demos.comparator.tagline')}
      />
    </div>
  );
}
