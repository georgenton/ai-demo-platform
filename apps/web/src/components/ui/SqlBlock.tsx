// SqlBlock — port TS de ui.jsx::SqlBlock.
//
// El highlighter vive en ./highlight-sql.ts (un .ts puro, sin JSX) para que
// vitest pueda testearlo sin chocar contra `tsconfig.jsx = preserve` que
// necesita Next.js. Este archivo es solo el componente React.

import { highlightSQL } from './highlight-sql';

export {
  highlightSQL,
  type SqlToken,
  type SqlTokenKind,
} from './highlight-sql';

export interface SqlBlockProps {
  sql: string;
}

export function SqlBlock({ sql }: SqlBlockProps) {
  const tokens = highlightSQL(sql);
  return (
    <pre className="sql-block">
      <code>
        {tokens.map((token, i) => (
          <span key={i} className={token.kind}>
            {token.text}
          </span>
        ))}
      </code>
    </pre>
  );
}
