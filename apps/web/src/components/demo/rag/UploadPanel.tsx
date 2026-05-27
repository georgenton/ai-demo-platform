// -----------------------------------------------------------------------------
// UploadPanel — contenido del modal de "Subir documento".
//
// Dos modos disponibles:
//   1) Drop / click zone para subir un PDF (multipart).
//   2) Formulario inferior con nombre + textarea para indexar texto plano.
//
// Estado interno: idle | uploading | success | error con un message si error.
// Cuando termina exitoso, dispara onSuccess(documentId) — la página padre
// refresca su lista y cierra el modal.
//
// Sin drag-and-drop real por ahora (sumar onDragOver/onDrop/preventDefault
// es polish; el click-to-upload alcanza para el demo). Cuando se quiera,
// son ~10 líneas adicionales.
// -----------------------------------------------------------------------------

'use client';

import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';

import { Button, Icon } from '@/components/ui';
import {
  ApiError,
  ingestPdf,
  ingestText,
  type DemoId,
  type IngestResponse,
} from '@/lib/api';
import { useT } from '@/lib/i18n';

export interface UploadPanelProps {
  demoId: DemoId;
  onSuccess: (response: IngestResponse) => void;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'uploading' }
  | { kind: 'error'; message: string };

export function UploadPanel({ demoId, onSuccess }: UploadPanelProps) {
  const { t } = useT();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handlePdf(file: File) {
    setStatus({ kind: 'uploading' });
    try {
      const result = await ingestPdf({ file, demoId });
      onSuccess(result);
    } catch (err) {
      setStatus({ kind: 'error', message: extractMessage(err) });
    }
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    handlePdf(file);
    // Reset el input para que el mismo archivo se pueda re-seleccionar.
    e.target.value = '';
  }

  async function onTextSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !content.trim()) return;
    setStatus({ kind: 'uploading' });
    try {
      const result = await ingestText({
        name: name.trim(),
        content: content.trim(),
        demoId,
      });
      onSuccess(result);
    } catch (err) {
      setStatus({ kind: 'error', message: extractMessage(err) });
    }
  }

  const uploading = status.kind === 'uploading';

  return (
    <div className="col" style={{ gap: 14 }}>
      <div
        role="button"
        tabIndex={0}
        className="drag-zone"
        onClick={() => !uploading && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !uploading) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        aria-busy={uploading}
        style={uploading ? { opacity: 0.6, cursor: 'progress' } : undefined}
      >
        <Icon
          name={uploading ? 'loader-2' : 'upload-cloud'}
          size={32}
          strokeWidth={1.4}
        />
        <p style={{ fontSize: 14, marginTop: 10, color: 'var(--color-fg)' }}>
          {t('rag.upload.drop')}
        </p>
        <p
          style={{ fontSize: 12, color: 'var(--color-fg-muted)', marginTop: 4 }}
        >
          {t('rag.upload.limits')}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={onFileChange}
          style={{ display: 'none' }}
          aria-hidden
        />
      </div>

      <form onSubmit={onTextSubmit} className="col" style={{ gap: 8 }}>
        <span className="eyebrow">{t('rag.upload.or')}</span>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('rag.upload.namePlaceholder')}
          disabled={uploading}
        />
        <textarea
          className="input textarea"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t('rag.upload.contentPlaceholder')}
          rows={4}
          disabled={uploading}
        />
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button
            type="submit"
            variant="primary"
            icon={uploading ? 'loader-2' : 'upload'}
            disabled={uploading || !name.trim() || !content.trim()}
          >
            {t('rag.upload.submit')}
          </Button>
        </div>
      </form>

      {status.kind === 'error' && (
        <div
          role="alert"
          style={{
            fontSize: 13,
            color: 'var(--color-danger)',
            background: 'var(--color-danger-bg)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
          }}
        >
          {status.message}
        </div>
      )}
    </div>
  );
}

function extractMessage(err: unknown): string {
  if (err instanceof ApiError) return `${err.status} — ${err.message}`;
  if (err instanceof Error) return err.message;
  return 'Error desconocido';
}
