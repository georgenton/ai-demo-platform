// -----------------------------------------------------------------------------
// AudienceLine — pequeña línea "Para quién es este demo" en el header.
//
// La info de audiencia ya existe en DemoRegistryService del backend (campo
// `audience: string[]`), pero las páginas del frontend no consumen el
// catálogo del backend en runtime. Para mantener la simplicidad, sumamos
// la audiencia al catálogo local (apps/web/src/lib/catalog/demos.ts) y
// este componente la pinta.
//
// Si en el futuro queremos sincronización automática backend ↔ frontend,
// se hace via @org/contracts. Hoy: regla social, ambos lados editados en
// el mismo PR.
// -----------------------------------------------------------------------------

import { useT } from '@/lib/i18n';

export interface AudienceLineProps {
  /** Lista de audiencias del demo. Se pintan como chips separados por bullet. */
  audience: readonly string[];
}

export function AudienceLine({ audience }: AudienceLineProps) {
  const { t } = useT();
  if (audience.length === 0) return null;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
        fontSize: 12,
        color: 'var(--color-fg-muted)',
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontWeight: 500 }}>{t('audience.label')}</span>
      {audience.map((aud, i) => (
        <span key={aud} style={{ display: 'inline-flex', gap: 8 }}>
          {i > 0 && <span aria-hidden>·</span>}
          <span>{aud}</span>
        </span>
      ))}
    </div>
  );
}
