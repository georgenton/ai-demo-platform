// -----------------------------------------------------------------------------
// CorpusUploadPanel — modal body para subir un batch de PDFs al corpus.
//
// Diferencias vs UploadPanel del RAG:
//   - Acepta MÚLTIPLES archivos a la vez (multi-select). El backend acepta
//     hasta 20 por request; mostramos disclaimer si suben más.
//   - No tiene modo "pegar texto plano" — el corpus es papers académicos
//     reales, asumimos PDF.
//   - El feedback muestra el batch: éxitos / fallidos / cuántos chunks
//     totales. Tomado del response de uploadCorpusBatch.
//
// Sin drag-and-drop real (mismo trade-off documentado en UploadPanel del
// RAG: click-to-upload alcanza para el demo).
// -----------------------------------------------------------------------------

'use client';

import { useRef, useState, type ChangeEvent } from 'react';

import { Button, Icon } from '@/components/ui';
import {
  ApiError,
  uploadCorpusBatch,
  type CorpusUploadResponse,
} from '@/lib/api';
import { useT } from '@/lib/i18n';

/** Mismo límite que el backend — coincidir evita una request fallida. */
const MAX_FILES_PER_BATCH = 20;

export interface CorpusUploadPanelProps {
  onSuccess: (response: CorpusUploadResponse) => void;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'uploading'; count: number }
  | { kind: 'success'; response: CorpusUploadResponse }
  | { kind: 'error'; message: string };

export function CorpusUploadPanel({ onSuccess }: CorpusUploadPanelProps) {
  const { t } = useT();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: File[]) {
    if (files.length === 0) return;

    const accepted = files.slice(0, MAX_FILES_PER_BATCH);
    setStatus({ kind: 'uploading', count: accepted.length });

    try {
      const response = await uploadCorpusBatch(accepted);
      setStatus({ kind: 'success', response });
      // No cerramos el modal automáticamente — el usuario quiere ver el
      // tally de éxitos/fallidos. La página padre puede mostrar un toast
      // o solo invalidar las stats.
      onSuccess(response);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err);
      setStatus({ kind: 'error', message });
    }
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list) return;
    const files = Array.from(list);
    void handleFiles(files);
    // Reset input para que seleccionar los mismos archivos otra vez sí
    // dispare onChange (sin esto, el segundo intento es no-op).
    e.target.value = '';
  }

  const busy = status.kind === 'uploading';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={busy}
        style={{
          border: '2px dashed var(--color-border-strong)',
          borderRadius: 8,
          padding: 32,
          background: 'var(--color-bg-sunken)',
          cursor: busy ? 'default' : 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          color: 'var(--color-fg-muted)',
          fontSize: 13,
          opacity: busy ? 0.6 : 1,
        }}
      >
        <Icon name="upload-cloud" size={28} strokeWidth={1.5} />
        <strong style={{ color: 'var(--color-fg)', fontSize: 14 }}>
          {t('corpus.upload.cta')}
        </strong>
        <span>{t('corpus.upload.hint')}</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          multiple
          onChange={onFileChange}
          style={{ display: 'none' }}
          disabled={busy}
        />
      </button>

      {status.kind === 'uploading' && (
        <StatusBox kind="info" icon="loader-circle">
          {t('corpus.upload.uploading', { n: status.count })}
        </StatusBox>
      )}

      {status.kind === 'success' && (
        <StatusBox kind="success" icon="check-circle">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <strong>
              {t('corpus.upload.successCount', {
                n: status.response.successCount,
              })}
            </strong>
            {status.response.failureCount > 0 && (
              <span style={{ color: 'var(--color-fg-muted)' }}>
                {t('corpus.upload.failureCount', {
                  n: status.response.failureCount,
                })}
              </span>
            )}
          </div>
        </StatusBox>
      )}

      {status.kind === 'error' && (
        <StatusBox kind="error" icon="circle-alert">
          {status.message}
        </StatusBox>
      )}

      <Button
        variant="ghost"
        size="md"
        onClick={() => fileInputRef.current?.click()}
        disabled={busy}
      >
        {t('corpus.upload.selectMore')}
      </Button>
    </div>
  );
}

interface StatusBoxProps {
  kind: 'info' | 'success' | 'error';
  icon: string;
  children: React.ReactNode;
}

function StatusBox({ kind, icon, children }: StatusBoxProps) {
  const colors = {
    info: {
      bg: 'var(--color-info-soft)',
      fg: 'var(--color-info)',
    },
    success: {
      bg: 'var(--color-success-soft)',
      fg: 'var(--color-success)',
    },
    error: {
      bg: 'var(--color-danger-soft)',
      fg: 'var(--color-danger)',
    },
  }[kind];

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        padding: 12,
        borderRadius: 8,
        background: colors.bg,
        color: colors.fg,
        fontSize: 13,
      }}
    >
      <Icon name={icon} size={16} strokeWidth={2} />
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
