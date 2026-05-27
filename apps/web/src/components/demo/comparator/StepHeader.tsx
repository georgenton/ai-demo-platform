// StepHeader — número circular (mono) + label + hint a la derecha.
// Port literal del componente del kit.

export interface StepHeaderProps {
  /** Número de paso ('1', '2', '3'). Lo mantenemos como string para
   *  preservar el ancho fijo del círculo cuando aparezca '10' si suma. */
  n: string;
  label: string;
  hint?: string;
}

export function StepHeader({ n, label, hint }: StepHeaderProps) {
  return (
    <div className="row" style={{ marginBottom: 12, gap: 10 }}>
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: 'var(--nai-navy-800)',
          color: 'white',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 600,
          fontFamily: 'var(--font-mono)',
          flexShrink: 0,
        }}
        aria-hidden
      >
        {n}
      </span>
      <h3 style={{ fontSize: 16, fontWeight: 600, whiteSpace: 'nowrap' }}>
        {label}
      </h3>
      <span className="spacer" />
      {hint && <span className="eyebrow">{hint}</span>}
    </div>
  );
}
