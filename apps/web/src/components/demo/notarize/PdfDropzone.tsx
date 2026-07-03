// -----------------------------------------------------------------------------
// PdfDropzone — drag&drop + click-to-pick para subir el PDF.
// Cuando hay archivo elegido, muestra el nombre + tamaño formateado + botón
// "sustituir". Solo permite mime application/pdf y el tamaño seguro que
// atraviesa el proxy de Vercel sin 413.
// -----------------------------------------------------------------------------

'use client';

import { useRef, useState } from 'react';

import { Icon } from '@/components/ui';
import {
  NOTARIZE_SAFE_PDF_MAX_BYTES,
  NOTARIZE_SAFE_PDF_MAX_LABEL,
} from '@/lib/api';
import { useT } from '@/lib/i18n';

interface Props {
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PdfDropzone({ file, onChange, disabled = false }: Props) {
  const { t } = useT();
  const [dragging, setDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function pick() {
    inputRef.current?.click();
  }

  function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const f = list[0];
    if (f.type !== 'application/pdf') {
      setValidationError(t('notarize.dropzone.invalidType'));
      onChange(null);
      return;
    }
    if (f.size > NOTARIZE_SAFE_PDF_MAX_BYTES) {
      setValidationError(
        t('notarize.dropzone.tooLarge', {
          max: NOTARIZE_SAFE_PDF_MAX_LABEL,
        }),
      );
      onChange(null);
      return;
    }
    setValidationError(null);
    onChange(f);
  }

  return (
    <div
      className={`notarize-dropzone${dragging ? ' dragging' : ''}${disabled ? ' disabled' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (disabled) return;
        handleFiles(e.dataTransfer?.files ?? null);
      }}
      onClick={!file && !disabled ? pick : undefined}
      role={!file ? 'button' : undefined}
      tabIndex={!file && !disabled ? 0 : undefined}
      onKeyDown={(e) => {
        if (!file && !disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          pick();
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        hidden
        disabled={disabled}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.currentTarget.value = '';
        }}
      />

      {file ? (
        <div className="notarize-dropzone-file">
          <Icon name="file-text" size={24} strokeWidth={1.5} />
          <div className="notarize-dropzone-file-text">
            {t('notarize.dropzone.fileLabel', {
              name: file.name,
              size: formatSize(file.size),
            })}
          </div>
          <button
            type="button"
            className="notarize-dropzone-replace"
            onClick={(e) => {
              e.stopPropagation();
              setValidationError(null);
              pick();
            }}
            disabled={disabled}
          >
            <Icon name="rotate-cw" size={14} />
            <span>{t('notarize.dropzone.replace')}</span>
          </button>
        </div>
      ) : (
        <div className="notarize-dropzone-empty">
          <Icon name="upload-cloud" size={32} strokeWidth={1.4} />
          <div>
            {dragging
              ? t('notarize.dropzone.dragging')
              : t('notarize.dropzone.idle')}
          </div>
        </div>
      )}
      {validationError && (
        <div className="notarize-dropzone-alert" role="alert">
          {validationError}
        </div>
      )}
    </div>
  );
}
