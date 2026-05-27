// -----------------------------------------------------------------------------
// KeybindingsLayer — monta los listeners globales de teclado y el overlay
// de ayuda. Vive en el shell para que esté presente en todas las rutas de
// demo (no en la landing pública).
//
// Provee `usePresentationMode` vía contexto liviano para que el
// PresentationToggle del header pueda leer/togglear el estado sin que el
// layout tenga que prop-drillearlo.
// -----------------------------------------------------------------------------

'use client';

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';

import {
  KEYBINDINGS_HELP,
  useKeybindings,
  usePresentationMode,
  type UsePresentationModeResult,
} from '@/lib/keybindings';
import { useT, type StringKey } from '@/lib/i18n';

import { Modal } from '@/components/ui';

// Contexto chico para compartir el estado de "presentando" con el
// PresentationToggle del header. No usamos un provider global aparte —
// vive y muere con el shell.
const PresentationContext = createContext<UsePresentationModeResult | null>(
  null,
);

export function usePresentation(): UsePresentationModeResult {
  const ctx = useContext(PresentationContext);
  if (!ctx) {
    // Fail fast en dev — significa que alguien renderizó el toggle fuera
    // del shell. Devolver un no-op silencioso oculta el bug.
    throw new Error(
      'usePresentation() debe usarse dentro de <KeybindingsLayer>',
    );
  }
  return ctx;
}

export function KeybindingsLayer({ children }: { children: ReactNode }) {
  const presentation = usePresentationMode();
  const [helpOpen, setHelpOpen] = useState(false);

  const openHelp = useCallback(() => setHelpOpen(true), []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);
  const toggleHelp = useCallback(() => setHelpOpen((v) => !v), []);

  useKeybindings({
    onToggleHelp: toggleHelp,
    onCloseHelp: closeHelp,
    onTogglePresenting: presentation.toggle,
    helpOpen,
  });

  return (
    <PresentationContext.Provider value={presentation}>
      {children}
      <ShortcutsHelpModal
        open={helpOpen}
        onClose={closeHelp}
        onOpen={openHelp}
      />
    </PresentationContext.Provider>
  );
}

// -----------------------------------------------------------------------------
// Overlay de ayuda. Lista las shortcuts con su descripción i18n.
// -----------------------------------------------------------------------------

interface ShortcutsHelpModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * Solo se usa para satisfacer el linter sobre props no usadas en algunos
   * call sites — el modal se abre por shortcut (?), no por click. Lo dejo
   * disponible por si en el futuro queremos un botón "Atajos" en el header.
   */
  onOpen?: () => void;
}

function ShortcutsHelpModal({ open, onClose }: ShortcutsHelpModalProps) {
  const { t } = useT();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('shortcuts.title')}
      width={460}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {KEYBINDINGS_HELP.map((entry) => (
          <div
            key={entry.keys}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 4px',
              fontSize: 13,
              gap: 16,
            }}
          >
            <span style={{ color: 'var(--color-fg)' }}>
              {t(entry.descriptionKey as StringKey)}
            </span>
            <ShortcutKey label={entry.keys} />
          </div>
        ))}
      </div>
      <p
        style={{
          marginTop: 14,
          fontSize: 11.5,
          color: 'var(--color-fg-muted)',
          lineHeight: 1.5,
        }}
      >
        {t('shortcuts.footer')}
      </p>
    </Modal>
  );
}

/**
 * Render del label de un atajo como `<kbd>` styled. Para combinaciones
 * con `+` (ej. "Shift + P") dividimos y pintamos cada tecla por separado.
 * Para secuencias (ej. "g r") usamos el espacio como separador visual.
 */
function ShortcutKey({ label }: { label: string }) {
  const parts = label.split(/(\s\+\s|\s)/).filter((p) => p.trim().length > 0);
  return (
    <span
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
      aria-label={label}
    >
      {parts.map((part, i) => {
        if (part === '+') {
          return (
            <span
              key={`sep-${i}`}
              style={{ color: 'var(--color-fg-muted)', fontSize: 11 }}
            >
              +
            </span>
          );
        }
        return (
          <kbd
            key={`${part}-${i}`}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              padding: '2px 6px',
              borderRadius: 4,
              border: '1px solid var(--color-border-strong)',
              background: 'var(--color-bg-sunken)',
              color: 'var(--color-fg)',
              minWidth: 18,
              textAlign: 'center',
              lineHeight: 1.4,
            }}
          >
            {part}
          </kbd>
        );
      })}
    </span>
  );
}
