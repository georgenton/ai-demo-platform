// -----------------------------------------------------------------------------
// (shell)/layout.tsx — layout compartido por TODAS las rutas de demo.
//
// Es un *route group* de App Router (paréntesis en el nombre): agrupa rutas
// que comparten layout sin afectar la URL. `/demo/rag` sigue siendo
// `/demo/rag`, pero hereda este layout que pinta sidebar + header.
//
// El layout root (apps/web/src/app/layout.tsx) ya monta los providers
// (Theme, Lang). Acá solo armamos la grilla `.app-shell` del ui-kit.css:
//
//     [ sidebar (264px) | main (header sticky + scroll)               ]
//
// El sidebar y el header son Client Components — usan hooks (usePathname,
// useT, useTheme). El layout en sí es Server Component (no hooks).
//
// KeybindingsLayer (Client) envuelve la grilla para que los atajos
// globales (?, Shift+P, g+r/c/a/s/h) estén montados en toda ruta del
// shell, y para proveer el contexto del modo presentación al header.
// -----------------------------------------------------------------------------

import { Header, KeybindingsLayer, Sidebar } from '@/components/shell';

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <KeybindingsLayer>
      <div className="app-shell">
        <Sidebar />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <Header />
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {children}
          </div>
        </div>
      </div>
    </KeybindingsLayer>
  );
}
