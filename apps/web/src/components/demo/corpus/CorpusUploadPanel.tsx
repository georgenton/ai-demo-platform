// -----------------------------------------------------------------------------
// CorpusUploadPanel — modal body para subir un batch de PDFs al corpus.
//
// Estrategia de subida: el usuario puede seleccionar múltiples archivos
// pero el cliente NO los manda como un único request multipart. En lugar
// de eso, itera y hace una llamada por archivo. Razón:
//
//   El proxy de Vercel (apps/web/src/app/api/[...path]/route.ts) corre
//   sobre Vercel Functions que tienen un límite de ~4.5MB por request body
//   en plan Hobby. Un batch real de 12 PDFs de tesis fácilmente supera ese
//   tope y devuelve HTTP 413 antes de llegar a Railway. Iterando uno por
//   uno cada PDF cabe holgado en el límite y, como bonus, si uno falla los
//   demás siguen.
//
// Diferencias vs UploadPanel del RAG:
//   - Acepta MÚLTIPLES archivos a la vez (multi-select), tope 20 igual que
//     el backend.
//   - No tiene modo "pegar texto plano" — el corpus es papers académicos
//     reales, asumimos PDF.
//   - El feedback muestra progreso en vivo: "Subiendo 3 de 12…", y al
//     final el tally de éxitos/fallidos.
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

/**
 * Resultado consolidado del loop. Acumulamos items exitosos de cada
 * llamada individual + las fallas (por nombre de archivo, para mostrar
 * detalle al usuario).
 */
interface BatchResult {
  successItems: CorpusUploadResponse['items'];
  failedNames: string[];
}

type Status =
  | { kind: 'idle' }
  | { kind: 'uploading'; current: number; total: number; currentName: string }
  | { kind: 'success'; result: BatchResult }
  | { kind: 'error'; message: string };

export function CorpusUploadPanel({ onSuccess }: CorpusUploadPanelProps) {
  const { t } = useT();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Itera los archivos uno por uno (ver razón en el header del archivo).
   * Cada iteración:
   *   1) Actualiza el status con "current N de TOTAL".
   *   2) Llama a uploadCorpusBatch([file]) — backend acepta el mismo
   *      endpoint con un único archivo igual que con varios.
   *   3) Si la respuesta tiene un item exitoso, lo acumulamos en
   *      successItems. Si vino con failureCount > 0 (raro: solo si el
   *      backend lo procesó pero falló downstream), lo acumulamos en
   *      failedNames.
   *   4) Si la llamada tira ApiError o network error, también lo
   *      acumulamos en failedNames. NO abortamos el loop — los siguientes
   *      archivos siguen.
   *
   * Al final, llamamos onSuccess con un response consolidado (mismo
   * shape que CorpusUploadResponse para mantener compatibilidad con
   * la página padre que invalida stats/list).
   */
  async function handleFiles(files: File[]) {
    if (files.length === 0) return;

    const accepted = files.slice(0, MAX_FILES_PER_BATCH);
    const result: BatchResult = { successItems: [], failedNames: [] };
    const total = accepted.length;

    for (let i = 0; i < total; i++) {
      const file = accepted[i];
      setStatus({
        kind: 'uploading',
        current: i + 1,
        total,
        currentName: file.name,
      });

      try {
        const response = await uploadCorpusBatch([file]);
        result.successItems.push(...response.items);
        // Si el backend reportó failureCount aunque el HTTP fue 2xx
        // (paper procesable pero extracción de metadata falló, por ej.),
        // contamos el archivo como fallido para el tally.
        if (response.failureCount > 0 && response.items.length === 0) {
          result.failedNames.push(file.name);
        }
      } catch (err) {
        const detail = err instanceof ApiError ? err.message : String(err);
        // Log al console para debug; el usuario ve el nombre en el tally.

        console.warn(`Falló upload de "${file.name}":`, detail);
        result.failedNames.push(file.name);
      }
    }

    setStatus({ kind: 'success', result });

    // Llamamos onSuccess con un response sintético — la página padre solo
    // necesita saber que hubo cambios para invalidar stats/list.
    onSuccess({
      items: result.successItems,
      successCount: result.successItems.length,
      failureCount: result.failedNames.length,
    });
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <strong>
              {t('corpus.upload.progress', {
                current: status.current,
                total: status.total,
              })}
            </strong>
            <span
              style={{
                color: 'var(--color-fg-muted)',
                fontSize: 12,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {status.currentName}
            </span>
          </div>
        </StatusBox>
      )}

      {status.kind === 'success' && (
        <StatusBox
          kind={status.result.failedNames.length === 0 ? 'success' : 'info'}
          icon={
            status.result.failedNames.length === 0
              ? 'check-circle'
              : 'circle-alert'
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <strong>
              {t('corpus.upload.successCount', {
                n: status.result.successItems.length,
              })}
            </strong>
            {status.result.failedNames.length > 0 && (
              <>
                <span style={{ color: 'var(--color-fg-muted)' }}>
                  {t('corpus.upload.failureCount', {
                    n: status.result.failedNames.length,
                  })}
                </span>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                    fontSize: 12,
                    color: 'var(--color-fg-muted)',
                  }}
                >
                  {status.result.failedNames.slice(0, 5).map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                  {status.result.failedNames.length > 5 && (
                    <li>
                      {t('corpus.upload.failureMore', {
                        n: status.result.failedNames.length - 5,
                      })}
                    </li>
                  )}
                </ul>
              </>
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
