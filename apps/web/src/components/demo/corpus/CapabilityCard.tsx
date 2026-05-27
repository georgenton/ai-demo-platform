// CapabilityCard — card del bloque de 3 capacidades del teaser Corpus.
// Icono mint en cuadrado, título, body. Sin shadow (Card flat de borde).

import { Card, Icon } from '@/components/ui';

export interface CapabilityCardProps {
  /** Nombre Lucide del icono. */
  icon: string;
  title: string;
  body: string;
}

export function CapabilityCard({ icon, title, body }: CapabilityCardProps) {
  return (
    <Card>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: 'var(--color-accent-soft)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--nai-mint-700)',
        }}
        aria-hidden
      >
        <Icon name={icon} size={18} strokeWidth={1.7} />
      </div>
      <h4 style={{ marginTop: 12, fontSize: 15, fontWeight: 600 }}>{title}</h4>
      <p
        style={{
          marginTop: 4,
          fontSize: 13,
          color: 'var(--color-fg-muted)',
          lineHeight: 1.55,
        }}
      >
        {body}
      </p>
    </Card>
  );
}
