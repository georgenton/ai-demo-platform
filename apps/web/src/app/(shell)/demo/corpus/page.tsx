// -----------------------------------------------------------------------------
// Demo 03 — Corpus académico.
//
// Página funcional (reemplaza el teaser estático original). Capacidades:
//   - Upload batch de PDFs (modal con drag/click multi-file).
//   - Stats agregados: total + papers por año + top tópicos.
//   - Búsqueda semántica sobre el corpus (SSE).
//   - Resumen ejecutivo auto-generado por LLM (SSE map-reduce).
//   - Listado paginado de papers con metadata.
//
// Composición:
//   - useCorpusStats() para stats (total, year chart, top topics).
//   - useCorpusPapers() para la tabla.
//   - useCorpusSearch() / useCorpusSummary() dentro de sus components.
//   - refreshKey: contador que la página incrementa post-upload; los
//     children que dependen de él (stats card / papers list) refetchean.
// -----------------------------------------------------------------------------

'use client';

import { useState } from 'react';

import { Button, Eyebrow, Modal } from '@/components/ui';
import { CorpusSearchSection } from '@/components/demo/corpus/CorpusSearchSection';
import { CorpusSummarySection } from '@/components/demo/corpus/CorpusSummarySection';
import { CorpusUploadPanel } from '@/components/demo/corpus/CorpusUploadPanel';
import { PapersByYearChart } from '@/components/demo/corpus/PapersByYearChart';
import { PapersList } from '@/components/demo/corpus/PapersList';
import { TopTopicsList } from '@/components/demo/corpus/TopTopicsList';
import { TotalPapersCard } from '@/components/demo/corpus/TotalPapersCard';
import { useTutorPricing } from '@/components/demo/tutor/use-tutor-pricing';
import { AudienceLine } from '@/components/shared/AudienceLine';
import { CostMiniWidget } from '@/components/shared/CostMiniWidget';
import { LlmProviderWarning } from '@/components/shared/LlmProviderWarning';
import { useEstimatedCost } from '@/components/shared/use-estimated-cost';
import { useCorpusStats } from '@/lib/api';
import { getDemoAudience } from '@/lib/catalog/demos';
import { useT } from '@/lib/i18n';
import { useLlmProvider } from '@/lib/llm';

const DEMO_ID = 'corpus' as const;

export default function DemoCorpusPage() {
  const { t } = useT();
  // Corpus también usa embeddings (indexa PDFs vía ingestService). Si el
  // dropdown está en anthropic, las acciones de búsqueda y upload fallan
  // con 400 — mostramos el banner y bloqueamos el upload (ver ADR-0018).
  const { provider } = useLlmProvider();
  const ragBlocked = provider === 'anthropic';

  const [uploadOpen, setUploadOpen] = useState(false);
  // refreshKey aumenta tras cada upload exitoso. Sus consumidores
  // (stats card + papers list) reciben el valor como prop y refetchean.
  const [refreshKey, setRefreshKey] = useState(0);

  const {
    data: stats,
    status: statsStatus,
    refetch: refetchStats,
  } = useCorpusStats();

  const total = stats?.totalPapers ?? 0;
  const papersByYear = stats?.papersByYear ?? [];
  const topTopics = stats?.topTopics ?? [];

  // Sugerencias de búsqueda — keywords típicos de tesis ecuatorianas.
  const suggested = [
    t('corpus.search.s1'),
    t('corpus.search.s2'),
    t('corpus.search.s3'),
  ];

  // Cost mini widget. En corpus los streams del LLM viven en sub-components
  // (CorpusSearchSection / CorpusSummarySection), así que el tracking de
  // tokens output queda fuera del scope de esta página por ahora — el
  // widget muestra "0 tokens" hasta que el usuario interactúa, pero ya
  // comunica el contraste $0 NAI vs $X comercial visualmente.
  const cost = useEstimatedCost();
  const { pricing } = useTutorPricing();
  const audience = getDemoAudience(DEMO_ID, t);

  function onUploadSuccess() {
    refetchStats();
    setRefreshKey((k) => k + 1);
    // No cerramos el modal automático — el usuario quiere ver el tally.
  }

  return (
    <div
      className="page"
      style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 20,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <Eyebrow>{t('corpus.eyebrow')}</Eyebrow>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              margin: '4px 0 8px 0',
            }}
          >
            {t('corpus.title')}
          </h1>
          <p
            style={{
              fontSize: 14,
              color: 'var(--color-fg-muted)',
              maxWidth: 720,
              lineHeight: 1.55,
              margin: 0,
            }}
          >
            {t('corpus.subtitle')}
          </p>
          <AudienceLine audience={audience} />
        </div>
        <div
          className="row"
          style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}
        >
          <CostMiniWidget usage={cost} pricing={pricing} demoId={DEMO_ID} />
          <Button
            variant="accent"
            icon="upload-cloud"
            onClick={() => setUploadOpen(true)}
            disabled={ragBlocked}
            title={ragBlocked ? t('rag.upload.disabled') : undefined}
          >
            {t('corpus.upload.button')}
          </Button>
        </div>
      </div>

      {ragBlocked && <LlmProviderWarning />}

      {/* Stats row: total + year chart + top topics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 2fr 2fr',
          gap: 14,
        }}
      >
        <TotalPapersCard
          total={total}
          loading={statsStatus === 'loading' && !stats}
        />
        <PapersByYearChart data={papersByYear} />
        <TopTopicsList data={topTopics} />
      </div>

      {/* Search + Summary side by side on wide screens */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: 14,
        }}
      >
        <CorpusSearchSection suggested={suggested} disabled={total === 0} />
        <CorpusSummarySection totalPapers={total} />
      </div>

      {/* Listado paginado */}
      <PapersList refreshKey={refreshKey} onPaperDeleted={refetchStats} />

      {/* Upload modal */}
      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title={t('corpus.upload.modalTitle')}
      >
        <CorpusUploadPanel onSuccess={onUploadSuccess} />
      </Modal>
    </div>
  );
}
