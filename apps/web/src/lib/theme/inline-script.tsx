// -----------------------------------------------------------------------------
// Script anti-FOUC para theme + lang.
//
// Se inyecta sincrónicamente en el <head> del documento ANTES de que React
// hidrate. Lee localStorage y setea `data-theme` y `lang` en el <html> para
// que el primer paint use el theme/lang correcto — sin esto, el usuario ve
// un flash light→dark cuando vuelve al sitio en modo oscuro.
//
// Por qué <Script strategy="beforeInteractive"> no sirve acá: ese strategy
// inyecta el script DESPUÉS del HTML inicial. Necesitamos que corra ANTES.
// La solución estándar en Next.js App Router es un <script
// dangerouslySetInnerHTML> dentro de <head>.
//
// Mantenemos las keys de storage en sincronía con LangProvider/ThemeProvider.
// -----------------------------------------------------------------------------

const SCRIPT = `
(function () {
  try {
    var theme = localStorage.getItem('adp-theme');
    if (theme !== 'light' && theme !== 'dark') theme = 'light';
    document.documentElement.setAttribute('data-theme', theme);

    var lang = localStorage.getItem('adp-lang');
    if (lang !== 'es' && lang !== 'en') lang = 'es';
    document.documentElement.setAttribute('lang', lang);
  } catch (e) {
    // Sin localStorage (sandboxed iframe, privacy mode, etc.) — defaults.
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.setAttribute('lang', 'es');
  }
})();
`.trim();

/**
 * Renderiza un <script> sin estrategia, que el browser ejecuta sync en el
 * orden en que aparece en el HTML. Debe ir al inicio del <head>, ANTES de
 * cualquier <link rel="stylesheet"> o componente de la app.
 */
export function ThemeInlineScript() {
  // dangerouslySetInnerHTML acá es intencional: necesitamos un script
  // sincrónico ANTES del primer paint, y la única forma de lograrlo en
  // App Router es inline HTML. Sin esto, FOUC light→dark al cargar.
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
