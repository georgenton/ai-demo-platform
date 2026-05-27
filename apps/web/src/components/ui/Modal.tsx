// Modal — port TS de ui.jsx::Modal.
//
// Scrim oscuro + dialog card centrado. Cierra con click-on-scrim y con
// Esc (lo agregamos respecto al kit). Trap focus es opcional — lo
// dejamos afuera para simplicidad; la accesibilidad mínima (Esc + click
// fuera) ya está.

'use client';

import { useEffect, type ReactNode } from 'react';

import { Icon } from './Icon';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Ancho de la card en px. Default 520. */
  width?: number;
  children?: ReactNode;
}

export function Modal({
  open,
  onClose,
  title,
  width = 520,
  children,
}: ModalProps) {
  // Cerrar con Escape. Solo cuando está abierto, para no escuchar siempre.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(8, 21, 42, 0.5)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width,
          maxWidth: '100%',
          boxShadow: 'var(--shadow-lg)',
          padding: 0,
          animation: 'materialize 220ms cubic-bezier(0.2,0.7,0.2,1)',
        }}
      >
        {title && (
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--color-border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <strong style={{ fontSize: 15, fontWeight: 600 }}>{title}</strong>
            <button
              type="button"
              onClick={onClose}
              className="theme-toggle"
              aria-label="Cerrar"
            >
              <Icon name="x" size={16} />
            </button>
          </div>
        )}
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}
