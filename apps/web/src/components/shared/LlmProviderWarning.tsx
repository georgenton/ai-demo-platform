// -----------------------------------------------------------------------------
// LlmProviderWarning — banner que aparece cuando el provider activo del
// dropdown del header no soporta el feature que la página necesita.
//
// Caso de uso actual (ADR-0018): demo RAG (chat RAG + ingest + corpus
// upload). Si el dropdown está en `anthropic`, el backend rechaza con 400
// porque Anthropic no fabrica embeddings. Mostrar este banner antes del
// flujo le evita al usuario un error confuso y le ofrece un atajo para
// cambiar al provider compatible (NAI on-prem).
//
// Diseño:
//   - Card al ancho de la página, fondo accent suave, icono "info" grande.
//   - Título + body + un botón primario "Cambiar a NAI on-prem".
//   - Cuando el user clickea el botón, llama setProvider('private-mac')
//     desde el LlmProviderContext y el banner desaparece (porque la
//     condición que lo monta deja de cumplirse).
//
// Patrón: el caller decide CUÁNDO mostrarlo. Este componente es solo el
// markup + el wiring del botón.
// -----------------------------------------------------------------------------

'use client';

import { Button, Icon } from '@/components/ui';
import { useLlmProvider } from '@/lib/llm';
import { useT } from '@/lib/i18n';

export function LlmProviderWarning() {
  const { t } = useT();
  const { setProvider } = useLlmProvider();

  return (
    <div className="llm-provider-warning" role="status">
      <div className="llm-provider-warning-icon" aria-hidden>
        <Icon name="server-off" size={24} strokeWidth={1.6} />
      </div>
      <div className="llm-provider-warning-text">
        <h3 className="llm-provider-warning-title">
          {t('rag.providerWarning.title')}
        </h3>
        <p className="llm-provider-warning-body">
          {t('rag.providerWarning.body')}
        </p>
      </div>
      <div className="llm-provider-warning-cta">
        <Button
          variant="primary"
          icon="server"
          onClick={() => setProvider('private-mac')}
        >
          {t('rag.providerWarning.cta')}
        </Button>
      </div>
    </div>
  );
}
