// ThemeToggle — botón del header que alterna light/dark.
// Class .theme-toggle del ui-kit.css.

'use client';

import { Icon } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useT();
  const tip = t('shell.theme.tip');
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      title={tip}
      aria-label={tip}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
    </button>
  );
}
