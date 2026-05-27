// -----------------------------------------------------------------------------
// Demo 03 — Corpus académico (teaser).
//
// Esta página NO consume backend (Demo 03 está bloqueado en la entrada de
// Python/FastAPI — ver docs/adr/0011-demo-03-waits-for-python.md). Es una
// pantalla de **roadmap visible para el cliente**: comunica que existe la
// visión, qué hace el demo y cuándo aterriza.
//
// Layout (kit):
//   1) Hero oscuro con CorpusViz, eyebrow "Próximamente · Q3 2026",
//      título grande, descripción y dos CTAs (placeholder — no van a
//      ninguna parte por ahora).
//   2) Grid de 3 CapabilityCards (procesamiento masivo, clustering,
//      evolución temporal).
//   3) Timeline de roadmap con 6 milestones (3 done, 1 current, 2
//      upcoming/highlight).
// -----------------------------------------------------------------------------

'use client';

import { Button, Eyebrow, Icon } from '@/components/ui';
import { CapabilityCard } from '@/components/demo/corpus/CapabilityCard';
import { CorpusViz } from '@/components/demo/corpus/CorpusViz';
import { Milestone } from '@/components/demo/corpus/Milestone';
import { useT } from '@/lib/i18n';

const DATE_LABELS = {
  mar: 'MAR 2026',
  may: 'MAY 2026',
  jun: 'JUN 2026',
  jul: 'JUL 2026',
  q3: 'Q3 2026',
};

export default function DemoCorpusPage() {
  const { t } = useT();
  return (
    <div className="page">
      <div className="teaser-hero">
        <CorpusViz />
        <div className="teaser-eyebrow">
          <Icon name="zap" size={11} strokeWidth={2.2} />
          {t('corpus.eyebrow')}
        </div>
        <h1 className="teaser-title">{t('corpus.title')}</h1>
        <p className="teaser-desc">{t('corpus.desc')}</p>
        <div style={{ marginTop: 28, display: 'flex', gap: 10 }}>
          <Button variant="accent" icon="bell" size="lg">
            {t('corpus.notify')}
          </Button>
          <Button
            variant="ghost"
            iconRight="arrow-right"
            size="lg"
            style={{ color: 'rgba(255,255,255,0.85)' }}
          >
            {t('corpus.roadmap')}
          </Button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 18,
          marginTop: 28,
        }}
      >
        <CapabilityCard
          icon="layers-3"
          title={t('corpus.cap1.title')}
          body={t('corpus.cap1.body')}
        />
        <CapabilityCard
          icon="git-branch-plus"
          title={t('corpus.cap2.title')}
          body={t('corpus.cap2.body')}
        />
        <CapabilityCard
          icon="line-chart"
          title={t('corpus.cap3.title')}
          body={t('corpus.cap3.body')}
        />
      </div>

      <div style={{ marginTop: 32 }}>
        <Eyebrow>{t('corpus.status')}</Eyebrow>
        <div style={{ marginTop: 14, position: 'relative' }}>
          {/* Línea vertical del timeline — atrás de los dots. */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: 11,
              top: 14,
              bottom: 14,
              width: 1,
              background: 'var(--color-border)',
            }}
          />
          <div className="col" style={{ gap: 16 }}>
            <Milestone done label={t('corpus.m1')} date={DATE_LABELS.mar} />
            <Milestone done label={t('corpus.m2')} date={DATE_LABELS.may} />
            <Milestone current label={t('corpus.m3')} date={DATE_LABELS.may} />
            <Milestone label={t('corpus.m4')} date={DATE_LABELS.jun} />
            <Milestone label={t('corpus.m5')} date={DATE_LABELS.jul} />
            <Milestone highlight label={t('corpus.m6')} date={DATE_LABELS.q3} />
          </div>
        </div>
      </div>
    </div>
  );
}
