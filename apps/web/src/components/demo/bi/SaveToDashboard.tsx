// -----------------------------------------------------------------------------
// SaveToDashboard — botón + modal para guardar un turn al dashboard.
//
// Flujo:
//   1. Click botón → abre modal con input para editar título (default =
//      chart.title).
//   2. Click Guardar → POST /bi/dashboard, muestra success inline, cierra
//      modal.
//   3. Si falla, muestra error en el modal sin cerrar.
// -----------------------------------------------------------------------------

'use client';

import { useEffect, useState } from 'react';

import { Button, Icon } from '@/components/ui';
import { createBiDashboardItem } from '@/lib/api';
import type { BiChartSpec } from '@/lib/api';
import { useT } from '@/lib/i18n';

interface Props {
  question: string;
  sql: string;
  chartSpec: BiChartSpec;
}

export function SaveToDashboard({ question, sql, chartSpec }: Props) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(chartSpec.title);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Reset al abrir.
  useEffect(() => {
    if (open) {
      setTitle(chartSpec.title);
      setError(null);
    }
  }, [open, chartSpec.title]);

  async function handleSave() {
    if (!title.trim()) {
      setError(t('bi.save.errorTitleEmpty'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createBiDashboardItem({
        title: title.trim(),
        question,
        sql,
        chartSpec,
      });
      setSaved(true);
      setOpen(false);
      // Reset indicador después de 2s.
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        icon={saved ? 'check' : 'bookmark-plus'}
        onClick={() => setOpen(true)}
        disabled={saving}
      >
        {saved ? t('bi.save.saved') : t('bi.save.button')}
      </Button>

      {open && (
        <>
          <div
            className="bi-modal-backdrop"
            onClick={() => !saving && setOpen(false)}
            aria-hidden="true"
          />
          <div
            className="bi-modal"
            role="dialog"
            aria-label={t('bi.save.modalTitle')}
          >
            <header className="bi-modal-header">
              <h3>{t('bi.save.modalTitle')}</h3>
              <button
                type="button"
                className="bi-modal-close"
                onClick={() => !saving && setOpen(false)}
                aria-label={t('bi.save.cancel')}
                disabled={saving}
              >
                <Icon name="x" size={16} />
              </button>
            </header>
            <div className="bi-modal-body">
              <p className="bi-modal-help">{t('bi.save.help')}</p>
              <label className="bi-modal-label" htmlFor="bi-save-title">
                {t('bi.save.titleLabel')}
              </label>
              <input
                id="bi-save-title"
                className="bi-modal-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                disabled={saving}
                autoFocus
              />
              {error && (
                <div className="bi-modal-error" role="alert">
                  <Icon name="triangle-alert" size={14} />
                  <span>{error}</span>
                </div>
              )}
            </div>
            <footer className="bi-modal-footer">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                {t('bi.save.cancel')}
              </Button>
              <Button
                variant="primary"
                size="md"
                icon={saving ? 'loader' : 'bookmark-plus'}
                onClick={handleSave}
                disabled={saving || title.trim().length === 0}
              >
                {saving ? t('bi.save.saving') : t('bi.save.confirm')}
              </Button>
            </footer>
          </div>
        </>
      )}
    </>
  );
}
