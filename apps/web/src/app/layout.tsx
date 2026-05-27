// -----------------------------------------------------------------------------
// Root layout — único Server Component en la cima del árbol.
//
// Responsabilidades:
//   1) Inyectar el CSS global (tokens + ui-kit).
//   2) Renderizar el script anti-FOUC en <head> (setea data-theme y lang
//      ANTES del primer paint).
//   3) Montar los providers (Theme + Lang) que el resto de la app consume.
//   4) Setear el shell HTML mínimo. El layout del shell (sidebar + header)
//      vive en el route group (shell)/layout.tsx — este root es solo
//      providers + globals.
//
// El atributo `lang` arranca como "es" (default); el script inline lo
// sobreescribe inmediatamente con el valor real de localStorage, y el
// LangProvider lo mantiene sincronizado en subsiguientes cambios.
// -----------------------------------------------------------------------------

import './global.css';

import { LangProvider } from '@/lib/i18n';
import { ThemeInlineScript, ThemeProvider } from '@/lib/theme';

export const metadata = {
  title: 'AI Demo Platform — Nutanix Enterprise AI',
  description:
    'Demos de IA empresarial corriendo sobre Nutanix Enterprise AI on-premise.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <ThemeInlineScript />
      </head>
      <body>
        <ThemeProvider>
          <LangProvider>{children}</LangProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
