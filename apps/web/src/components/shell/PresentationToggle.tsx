// -----------------------------------------------------------------------------
// PresentationToggle — botón en el header que activa/desactiva el modo
// presentación. Mismo "look" que ThemeToggle / LangSwitch (clase
// .theme-toggle del ui-kit.css).
//
// Sin atajo aparte: el shortcut global Shift+P (en useKeybindings) ya cubre
// teclado. El botón existe solo para discoverability — la primera vez que
// Edguitar o Jorge presentan, no van a saber que existe el atajo. Una vez
// que lo descubren, lo usan por teclado y se olvidan del botón.
// -----------------------------------------------------------------------------

'use client';

import { Icon } from '@/components/ui';
import { useT } from '@/lib/i18n';

import { usePresentation } from './KeybindingsLayer';

export function PresentationToggle() {
  const { t } = useT();
  const { presenting, toggle } = usePresentation();
  return (
    <button
      type="button"
      onClick={toggle}
      className="theme-toggle"
      aria-pressed={presenting}
      aria-label={
        presenting
          ? t('shell.presentation.exit')
          : t('shell.presentation.enter')
      }
      title={
        presenting
          ? t('shell.presentation.exit')
          : t('shell.presentation.enter')
      }
    >
      <Icon name={presenting ? 'minimize-2' : 'maximize-2'} size={14} />
    </button>
  );
}
