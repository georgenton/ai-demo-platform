// -----------------------------------------------------------------------------
// Demo 08 — Notarización cooperativa con IA (ADR-0019).
//
// Estados de la página:
//   - 'idle':    el wizard de subida (tipo + PDF + modo + submit).
//   - 'submitting': loading mientras el backend hace todo el pipeline.
//   - 'result': se muestra el documento notarizado con sus sellos + análisis.
//   - 'error':  mensaje + botón "intentar de nuevo".
//
// El flujo entero del backend (hash → notarize → analyze) ocurre en un solo
// request POST `/api/v1/notarize`. No hay streaming SSE — es síncrono.
// -----------------------------------------------------------------------------

'use client';

import { useState } from 'react';

import { Button, Eyebrow, Icon } from '@/components/ui';
import { AnalysisPanel } from '@/components/demo/notarize/AnalysisPanel';
import { AnchorBadges } from '@/components/demo/notarize/AnchorBadges';
import { DocTypeSelector } from '@/components/demo/notarize/DocTypeSelector';
import { ModeSelector } from '@/components/demo/notarize/ModeSelector';
import { PdfDropzone } from '@/components/demo/notarize/PdfDropzone';
import { AudienceLine } from '@/components/shared/AudienceLine';
import { CostMiniWidget } from '@/components/shared/CostMiniWidget';
import { useTutorPricing } from '@/components/demo/tutor/use-tutor-pricing';
import { useEstimatedCost } from '@/components/shared/use-estimated-cost';
import {
  uploadNotarize,
  type NotarizedDocType,
  type NotarizedDocument,
  type NotarizeMode,
} from '@/lib/api';
import { ApiError } from '@/lib/api/client';
import { getDemoAudience } from '@/lib/catalog/demos';
import { useT } from '@/lib/i18n';

const DEMO_ID = 'notarize' as const;

type Status = 'idle' | 'submitting' | 'result' | 'error';

export default function DemoNotarizePage() {
  const { t } = useT();
  const audience = getDemoAudience(DEMO_ID, t);
  const cost = useEstimatedCost();
  const { pricing } = useTutorPricing();

  const [docType, setDocType] = useState<NotarizedDocType>('assembly_minutes');
  const [mode, setMode] = useState<NotarizeMode>('both');
  const [file, setFile] = useState<File | null>(null);

  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<NotarizedDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (!file || status === 'submitting') return;
    setStatus('submitting');
    setError(null);
    try {
      const res = await uploadNotarize({ file, docType, mode });
      setResult(res);
      setStatus('result');
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Error desconocido';
      setError(msg);
      setStatus('error');
    }
  }

  function reset() {
    setStatus('idle');
    setResult(null);
    setError(null);
    setFile(null);
  }

  return (
    <div className="page notarize-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title-eyebrow">{t('notarize.eyebrow')}</div>
          <h1 className="page-title">{t('notarize.title')}</h1>
          <p className="page-subtitle">{t('notarize.subtitle')}</p>
          <AudienceLine audience={audience} />
        </div>
        <div
          className="row"
          style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}
        >
          <CostMiniWidget usage={cost} pricing={pricing} demoId={DEMO_ID} />
        </div>
      </div>

      {/* Cuerpo según status */}
      {status === 'result' && result ? (
        <ResultView doc={result} onNewOne={reset} />
      ) : (
        <Wizard
          docType={docType}
          mode={mode}
          file={file}
          status={status}
          error={error}
          onDocType={setDocType}
          onMode={setMode}
          onFile={setFile}
          onSubmit={onSubmit}
          onRetry={() => setStatus('idle')}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponentes
// ---------------------------------------------------------------------------

interface WizardProps {
  docType: NotarizedDocType;
  mode: NotarizeMode;
  file: File | null;
  status: Status;
  error: string | null;
  onDocType: (t: NotarizedDocType) => void;
  onMode: (m: NotarizeMode) => void;
  onFile: (f: File | null) => void;
  onSubmit: () => void;
  onRetry: () => void;
}

function Wizard({
  docType,
  mode,
  file,
  status,
  error,
  onDocType,
  onMode,
  onFile,
  onSubmit,
  onRetry,
}: WizardProps) {
  const { t } = useT();
  const submitting = status === 'submitting';
  const canSubmit = !!file && !submitting;

  return (
    <div className="notarize-wizard">
      {/* Step 1 */}
      <section className="notarize-step">
        <Eyebrow>1 · {t('notarize.step1.title')}</Eyebrow>
        <p className="notarize-step-hint">{t('notarize.step1.hint')}</p>
        <DocTypeSelector
          value={docType}
          onChange={onDocType}
          disabled={submitting}
        />
      </section>

      {/* Step 2 */}
      <section className="notarize-step">
        <Eyebrow>2 · {t('notarize.step2.title')}</Eyebrow>
        <p className="notarize-step-hint">{t('notarize.step2.hint')}</p>
        <PdfDropzone file={file} onChange={onFile} disabled={submitting} />
      </section>

      {/* Step 3 */}
      <section className="notarize-step">
        <Eyebrow>3 · {t('notarize.step3.title')}</Eyebrow>
        <p className="notarize-step-hint">{t('notarize.step3.hint')}</p>
        <ModeSelector value={mode} onChange={onMode} disabled={submitting} />
      </section>

      {/* CTA */}
      <div className="notarize-cta">
        <Button
          variant="primary"
          icon={submitting ? 'loader' : 'shield-check'}
          size="lg"
          disabled={!canSubmit}
          onClick={onSubmit}
        >
          {submitting ? t('notarize.submitting') : t('notarize.submit')}
        </Button>
      </div>

      {status === 'error' && error && (
        <div className="notarize-error" role="alert">
          <div className="notarize-error-icon">
            <Icon name="triangle-alert" size={18} />
          </div>
          <div className="notarize-error-text">
            <div className="notarize-error-title">
              {t('notarize.errorTitle')}
            </div>
            <div className="notarize-error-msg">{error}</div>
          </div>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {t('notarize.errorRetry')}
          </Button>
        </div>
      )}
    </div>
  );
}

interface ResultProps {
  doc: NotarizedDocument;
  onNewOne: () => void;
}

function ResultView({ doc, onNewOne }: ResultProps) {
  const { t } = useT();
  const shortHash = `${doc.contentHash.slice(0, 8)}…${doc.contentHash.slice(-6)}`;
  const sizeKb =
    doc.contentSize < 1024 * 1024
      ? `${(doc.contentSize / 1024).toFixed(1)} KB`
      : `${(doc.contentSize / (1024 * 1024)).toFixed(1)} MB`;
  const createdAt = new Date(doc.createdAt).toLocaleString();

  return (
    <div className="notarize-result">
      {/* Header de resultado */}
      <div className="notarize-result-header">
        <div className="notarize-result-icon">
          <Icon name="check-circle-2" size={28} strokeWidth={1.8} />
        </div>
        <div className="notarize-result-body">
          <h2 className="notarize-result-title">
            {t('notarize.result.title')}
          </h2>
          <p className="notarize-result-subtitle">
            {t('notarize.result.subtitle', { hash: shortHash })}
          </p>
        </div>
        <Button variant="secondary" icon="plus" onClick={onNewOne}>
          {t('notarize.result.newOne')}
        </Button>
      </div>

      {/* Metadata */}
      <dl className="notarize-meta">
        <div className="notarize-meta-row">
          <dt>{t('notarize.result.contentHash')}</dt>
          <dd>
            <code className="notarize-hash">{doc.contentHash}</code>
          </dd>
        </div>
        <div className="notarize-meta-row">
          <dt>{t('notarize.result.fileSize')}</dt>
          <dd>
            {doc.name} · {sizeKb}
          </dd>
        </div>
        <div className="notarize-meta-row">
          <dt>{t('notarize.result.createdAt')}</dt>
          <dd>{createdAt}</dd>
        </div>
      </dl>

      {/* Anchors */}
      <AnchorBadges anchors={doc.anchors} />

      {/* Análisis */}
      <AnalysisPanel analysis={doc.analysis} />
    </div>
  );
}
