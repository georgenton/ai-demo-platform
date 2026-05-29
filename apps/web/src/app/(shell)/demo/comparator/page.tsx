// -----------------------------------------------------------------------------
// Demo 02 — Comparador de documentos.
//
// Layout (kit): dos columnas grid.
//   Izquierda: Step 1 (selección de docs) + Step 2 (dimensiones).
//   Derecha:   Step 3 (output streameando).
//
// Wiring:
//   - useDocuments({ demoId: 'comparator' }) trae los docs disponibles.
//   - useCompareStream() envuelve POST /api/v1/compare (SSE de tokens).
//   - SUGGESTED_DIMENSIONS_I18N para chips clickeables de dimensiones.
//
// Reglas de validación (espejo del backend):
//   - 2 ≤ docs ≤ 5
//   - 1 ≤ dimensions ≤ 10
//   - duplicados rechazados en cliente (el backend también los rechaza)
// -----------------------------------------------------------------------------

'use client';

import { useEffect, useState } from 'react';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  Modal,
  Pill,
} from '@/components/ui';
import { useDocuments } from '@/components/demo/rag/use-documents';
import { UploadPanel } from '@/components/demo/rag/UploadPanel';
import { CompareDocRow } from '@/components/demo/comparator/CompareDocRow';
import { MarkdownOutput } from '@/components/demo/comparator/MarkdownOutput';
import { StepHeader } from '@/components/demo/comparator/StepHeader';
import { useCompareStream } from '@/components/demo/comparator/use-compare-stream';
import { useTutorPricing } from '@/components/demo/tutor/use-tutor-pricing';
import { AudienceLine } from '@/components/shared/AudienceLine';
import { CostMiniWidget } from '@/components/shared/CostMiniWidget';
import {
  useEstimatedCost,
  useTextDelta,
} from '@/components/shared/use-estimated-cost';
import { getDemoAudience } from '@/lib/catalog/demos';
import { SUGGESTED_DIMENSIONS_I18N, useT } from '@/lib/i18n';

const DEMO_ID = 'comparator' as const;
const MAX_DOCS = 5;
const MIN_DOCS = 2;
const MAX_DIMENSIONS = 10;

export default function DemoComparatorPage() {
  const { t, lang } = useT();
  const {
    documents,
    status: docsStatus,
    refresh,
    remove,
  } = useDocuments(DEMO_ID);
  const { text, status: streamStatus, start } = useCompareStream();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dimensions, setDimensions] = useState<string[]>([]);
  const [dimInput, setDimInput] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);

  // Cuando cambia el idioma, las dimensiones predeterminadas se resetean
  // a las dos primeras sugeridas en la lengua actual.
  useEffect(() => {
    setDimensions(SUGGESTED_DIMENSIONS_I18N[lang].slice(0, 2));
  }, [lang]);

  const running = streamStatus === 'streaming';
  const done = streamStatus === 'done';
  const valid = selectedIds.length >= MIN_DOCS && dimensions.length >= 1;

  function toggleDoc(id: string) {
    setSelectedIds((ids) => {
      if (ids.includes(id)) return ids.filter((x) => x !== id);
      if (ids.length >= MAX_DOCS) return ids;
      return [...ids, id];
    });
  }

  function addDimension(dim: string) {
    const d = dim.trim();
    if (!d || dimensions.includes(d) || dimensions.length >= MAX_DIMENSIONS) {
      return;
    }
    setDimensions((arr) => [...arr, d]);
    setDimInput('');
  }

  function removeDimension(d: string) {
    setDimensions((arr) => arr.filter((x) => x !== d));
  }

  // Cost mini widget — pricing + acumulación estimada local.
  const cost = useEstimatedCost();
  const { pricing } = useTutorPricing();
  useTextDelta(text, cost.addOutput);
  const audience = getDemoAudience(DEMO_ID, t);

  function startCompare() {
    if (!valid || running) return;
    // El input "real" del compare es la concatenación de los IDs + las
    // dimensiones — aproximación visual del tamaño del prompt.
    cost.addInput(
      `documentIds:${selectedIds.join(',')} dimensions:${dimensions.join(',')}`,
    );
    start({ documentIds: selectedIds, dimensions, demoId: DEMO_ID });
  }

  const suggestions = SUGGESTED_DIMENSIONS_I18N[lang];
  const availableSuggestions = suggestions.filter(
    (d) => !dimensions.includes(d),
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title-eyebrow">{t('cmp.eyebrow')}</div>
          <h1 className="page-title">{t('cmp.title')}</h1>
          <p className="page-subtitle">{t('cmp.subtitle')}</p>
          <AudienceLine audience={audience} />
        </div>
        <div
          className="row"
          style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}
        >
          <CostMiniWidget usage={cost} pricing={pricing} demoId={DEMO_ID} />
          <Button
            variant="accent"
            icon="sparkles"
            size="lg"
            disabled={!valid || running}
            onClick={startCompare}
          >
            {running ? t('cmp.generating') : t('cmp.generate')}
          </Button>
        </div>
      </div>

      <div
        style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 24 }}
      >
        <div className="col" style={{ gap: 22 }}>
          {/* Step 1 — selección de documentos */}
          <section>
            <StepHeader
              n="1"
              label={t('cmp.step1.label')}
              hint={t('cmp.step1.hint', { n: selectedIds.length })}
            />
            <div
              style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}
            >
              {docsStatus === 'loading' && documents.length === 0 ? (
                <DocsLoading />
              ) : documents.length === 0 ? (
                <EmptyState
                  icon="file-search"
                  title={t('rag.docs.empty')}
                  body={t('cmp.step1.more')}
                  action={
                    <Button
                      variant="primary"
                      icon="upload"
                      onClick={() => setUploadOpen(true)}
                    >
                      {t('rag.upload')}
                    </Button>
                  }
                />
              ) : (
                documents.map((doc) => {
                  const selected = selectedIds.includes(doc.id);
                  const atCap = selectedIds.length >= MAX_DOCS && !selected;
                  return (
                    <CompareDocRow
                      key={doc.id}
                      doc={doc}
                      selected={selected}
                      onToggle={() => toggleDoc(doc.id)}
                      disabled={atCap}
                      onDelete={() => {
                        // Si el doc estaba seleccionado, lo quitamos
                        // primero — sino quedaría un id huérfano en
                        // selectedIds tras el delete.
                        setSelectedIds((ids) =>
                          ids.filter((x) => x !== doc.id),
                        );
                        void remove(doc.id);
                      }}
                    />
                  );
                })
              )}
            </div>
            {documents.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <Button
                  variant="ghost"
                  icon="upload"
                  size="sm"
                  onClick={() => setUploadOpen(true)}
                >
                  {t('cmp.step1.more')}
                </Button>
              </div>
            )}
          </section>

          {/* Step 2 — dimensiones */}
          <section>
            <StepHeader
              n="2"
              label={t('cmp.step2.label')}
              hint={t('cmp.step2.hint', { n: dimensions.length })}
            />
            <Card flat style={{ padding: 12 }}>
              <div
                className="row"
                style={{
                  flexWrap: 'wrap',
                  gap: 6,
                  padding: '2px 0 10px 0',
                  borderBottom: '1px solid var(--color-border-subtle)',
                }}
              >
                {dimensions.length === 0 && (
                  <span
                    style={{ fontSize: 13, color: 'var(--color-fg-subtle)' }}
                  >
                    {t('cmp.step2.empty')}
                  </span>
                )}
                {dimensions.map((d) => (
                  <span
                    key={d}
                    className="badge badge-neutral"
                    style={{ padding: '4px 10px', fontSize: 12 }}
                  >
                    {d}
                    <button
                      type="button"
                      onClick={() => removeDimension(d)}
                      style={{
                        background: 'none',
                        border: 0,
                        color: 'inherit',
                        cursor: 'pointer',
                        padding: 0,
                        marginLeft: 4,
                        opacity: 0.7,
                      }}
                      aria-label={t('common.remove')}
                    >
                      <Icon name="x" size={11} strokeWidth={2.2} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="row" style={{ marginTop: 10, gap: 8 }}>
                <input
                  className="input"
                  value={dimInput}
                  onChange={(e) => setDimInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addDimension(dimInput);
                    }
                  }}
                  placeholder={t('cmp.step2.input')}
                  disabled={dimensions.length >= MAX_DIMENSIONS}
                />
                <Button
                  variant="secondary"
                  icon="plus"
                  onClick={() => addDimension(dimInput)}
                  disabled={
                    !dimInput.trim() || dimensions.length >= MAX_DIMENSIONS
                  }
                >
                  {t('cmp.step2.add')}
                </Button>
              </div>
              <div style={{ marginTop: 12 }}>
                <div className="eyebrow" style={{ marginBottom: 8 }}>
                  {t('cmp.step2.suggestions')}
                </div>
                <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                  {availableSuggestions.map((d) => (
                    <Pill key={d} icon="plus" onClick={() => addDimension(d)}>
                      {d}
                    </Pill>
                  ))}
                </div>
              </div>
            </Card>
          </section>
        </div>

        {/* Step 3 — output */}
        <div className="col" style={{ gap: 14, minHeight: 480 }}>
          <StepHeader
            n="3"
            label={t('cmp.step3.label')}
            hint={
              running
                ? t('cmp.step3.streaming')
                : done
                  ? t('cmp.step3.done')
                  : t('cmp.step3.pending')
            }
          />
          <Card
            style={{
              padding: 0,
              minHeight: 480,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--color-border-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                justifyContent: 'space-between',
              }}
            >
              <div className="row" style={{ gap: 8 }}>
                <Icon name="git-compare-arrows" size={14} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>
                  {t('cmp.step3.docsXdim', {
                    docs: selectedIds.length,
                    dims: dimensions.length,
                  })}
                </span>
              </div>
              {done && (
                <Badge tone="success" icon="check">
                  {t('common.done')}
                </Badge>
              )}
              {running && (
                <Badge tone="info" icon="loader">
                  {t('common.streaming')}
                </Badge>
              )}
            </div>
            <div style={{ flex: 1, padding: 18, overflowY: 'auto' }}>
              {!text && !running ? (
                <EmptyState
                  icon="file-search"
                  title={t('cmp.step3.ready.title')}
                  body={t('cmp.step3.ready.body')}
                />
              ) : (
                <>
                  <MarkdownOutput text={text} />
                  {running && <span className="stream-cursor" aria-hidden />}
                </>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title={t('rag.upload.title')}
      >
        <UploadPanel
          demoId={DEMO_ID}
          onSuccess={() => {
            setUploadOpen(false);
            refresh();
          }}
        />
      </Modal>
    </div>
  );
}

function DocsLoading() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="skeleton"
          style={{ height: 64, borderRadius: 10 }}
        />
      ))}
    </>
  );
}
