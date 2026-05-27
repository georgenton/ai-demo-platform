// SchemaPanel — columna derecha de la consola del agente. Lista las 4 tablas
// accesibles + una nota de seguridad ("solo puede leer estas tablas").
//
// Esto transmite confianza al cliente: el agente no es una caja negra que
// "habla con la base"; sabe exactamente qué puede tocar.

import { Card, Eyebrow, Icon, SchemaTable } from '@/components/ui';
import { AGENT_SCHEMA } from '@/lib/catalog/agent-schema';
import { useT } from '@/lib/i18n';

export function SchemaPanel() {
  const { t } = useT();
  return (
    <aside
      className="col"
      style={{ gap: 12, minHeight: 0 }}
      aria-label={t('agent.schema')}
    >
      <Eyebrow>{t('agent.schema')}</Eyebrow>
      <Card style={{ padding: 14 }}>
        <div
          className="row"
          style={{
            gap: 8,
            fontSize: 12,
            color: 'var(--color-fg-muted)',
            marginBottom: 10,
            lineHeight: 1.5,
            alignItems: 'flex-start',
          }}
        >
          <Icon
            name="shield"
            size={13}
            style={{
              flexShrink: 0,
              marginTop: 1,
              color: 'var(--nai-mint-600)',
            }}
          />
          <span>{t('agent.schema.note')}</span>
        </div>
        <div className="col" style={{ gap: 8 }}>
          {AGENT_SCHEMA.map((table) => (
            <SchemaTable
              key={table.name}
              name={table.name}
              columns={[...table.columns]}
            />
          ))}
        </div>
      </Card>
    </aside>
  );
}
