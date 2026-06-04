// -----------------------------------------------------------------------------
// ClinicalEntry — render de una entrada de la timeline del asistente.
//
// La timeline visual mezcla 3 tipos de entradas:
//   - `question` (local, no viene del SSE): la pregunta del médico que
//     inició el análisis. Burbuja del lado del usuario.
//   - `text` (del hook): texto que el LLM va emitiendo. Burbuja del
//     asistente, con cursor parpadeante si todavía está streameando.
//   - `tool_call` (del hook): el LLM pidió consultar interacciones — card
//     con pulse mientras el `tool_result` no llegue.
//   - `tool_result` (del hook): resultado del lookup — card verde "sin
//     interacciones" o card con filas + severity pills.
//
// El streaming "machine typing" lo hace el backend (SSE manda texto chunk
// a chunk), así que renderizamos el text crudo — el efecto visual ya está.
// -----------------------------------------------------------------------------

'use client';

import { Badge, Icon } from '@/components/ui';
import { useT } from '@/lib/i18n';
import type { StringKey } from '@/lib/i18n';
import type {
  ClinicalAnalyzeEntry,
  ClinicalInteraction,
  ClinicalInteractionSeverity,
} from '@/lib/api';

/**
 * Map de severidad → key i18n. Mantiene `t()` con keys literales del union
 * (template strings rompen el tipo). El backend solo emite estos 3 valores.
 */
const SEVERITY_KEY: Record<ClinicalInteractionSeverity, StringKey> = {
  leve: 'clinical.sev.leve',
  moderada: 'clinical.sev.moderada',
  grave: 'clinical.sev.grave',
};

/** Entrada "question" agregada por la página al enviar — no viaja en el SSE. */
export interface QuestionEntry {
  kind: 'question';
  text: string;
}

/** Tipo unión que combina la entrada local + las del hook. */
export type ClinicalTimelineEntry = QuestionEntry | ClinicalAnalyzeEntry;

interface Props {
  entry: ClinicalTimelineEntry;
  /** `true` si esta es la última entry Y el stream sigue corriendo. */
  pending: boolean;
}

export function ClinicalEntry({ entry, pending }: Props) {
  if (entry.kind === 'question') return <QuestionBubble text={entry.text} />;
  if (entry.kind === 'text')
    return <AssistantBubble text={entry.text} streaming={pending} />;
  if (entry.kind === 'tool_call')
    return <ToolCallCard medications={entry.medications} pending={pending} />;
  if (entry.kind === 'tool_result')
    return <ToolResultCard interactions={entry.interactions} />;
  return null;
}

// ---------------------------------------------------------------------------
// Burbujas
// ---------------------------------------------------------------------------

function QuestionBubble({ text }: { text: string }) {
  return (
    <div className="bubble-row user">
      <div className="bubble user">{text}</div>
    </div>
  );
}

function AssistantBubble({
  text,
  streaming,
}: {
  text: string;
  streaming: boolean;
}) {
  return (
    <div className="bubble-row assistant">
      <div className="avatar">AI</div>
      <div className="bubble assistant">
        <span>{text}</span>
        {streaming && <span className="stream-cursor" />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cards de tool calling
// ---------------------------------------------------------------------------

function ToolCallCard({
  medications,
  pending,
}: {
  medications: string[];
  pending: boolean;
}) {
  const { t } = useT();
  return (
    <div className={`clin-tool${pending ? ' pending' : ''}`}>
      <div className="clin-tool-head">
        <span className="clin-tool-icon">
          <Icon name="pill" size={13} strokeWidth={1.75} />
        </span>
        <span className="clin-tool-kicker">{t('clinical.tool.kicker')}</span>
        {pending && (
          <>
            <span style={{ flex: 1 }} />
            <span className="clin-tool-pulse" />
          </>
        )}
      </div>
      <div className="clin-tool-drugs">
        {t('clinical.tool.calling', { drugs: '' })}
        <span className="mono">{medications.join(', ')}</span>
      </div>
    </div>
  );
}

function ToolResultCard({
  interactions,
}: {
  interactions: ClinicalInteraction[];
}) {
  const { t } = useT();

  if (interactions.length === 0) {
    return (
      <div className="clin-tool">
        <div className="clin-tool-none">
          <Icon name="check" size={14} strokeWidth={2.25} />
          <span>{t('clinical.tool.none')}</span>
        </div>
      </div>
    );
  }

  const foundLabel =
    interactions.length === 1
      ? t('clinical.tool.found', { n: 1 })
      : t('clinical.tool.found.many', { n: interactions.length });

  return (
    <div className="clin-tool">
      <div className="clin-tool-head">
        <span className="clin-tool-icon ok">
          <Icon name="list-checks" size={13} strokeWidth={1.75} />
        </span>
        <span className="clin-tool-kicker">
          {t('clinical.tool.resultKicker')}
        </span>
        <span style={{ flex: 1 }} />
        <Badge tone="neutral" mono>
          {foundLabel}
        </Badge>
      </div>
      <div>
        {interactions.map((it, i) => (
          <InteractionRow key={i} interaction={it} />
        ))}
      </div>
    </div>
  );
}

function InteractionRow({ interaction }: { interaction: ClinicalInteraction }) {
  return (
    <div className="interaction-row">
      <div className="interaction-drugs">
        <span className="interaction-drug">{interaction.drugA}</span>
        <span className="interaction-x">·</span>
        <span className="interaction-drug">{interaction.drugB}</span>
        <span style={{ flex: 1 }} />
        <SeverityPill severity={interaction.severity} />
      </div>
      <div className="interaction-desc">{interaction.description}</div>
    </div>
  );
}

function SeverityPill({ severity }: { severity: ClinicalInteractionSeverity }) {
  const { t } = useT();
  const icon =
    severity === 'grave'
      ? 'octagon-alert'
      : severity === 'moderada'
        ? 'triangle-alert'
        : 'circle-alert';
  return (
    <span className={`sev-pill sev-${severity}`}>
      <Icon name={icon} size={10} strokeWidth={2.5} />
      {t(SEVERITY_KEY[severity])}
    </span>
  );
}

// ---------------------------------------------------------------------------
// "Pensando…" — placeholder mientras el LLM razona antes del primer token
// o entre tool calls.
// ---------------------------------------------------------------------------

export function ThinkingRow({ label }: { label: string }) {
  return (
    <div className="bubble-row assistant">
      <div className="avatar">AI</div>
      <div
        className="bubble assistant"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}
      >
        <ThinkingDots />
        <span style={{ fontSize: 12, color: 'var(--color-fg-muted)' }}>
          {label}
        </span>
      </div>
    </div>
  );
}

function ThinkingDots() {
  return (
    <span className="thinking-dots" aria-hidden>
      <span />
      <span />
      <span />
    </span>
  );
}
