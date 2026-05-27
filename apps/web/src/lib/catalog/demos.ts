// -----------------------------------------------------------------------------
// Catálogo local de demos — fuente de verdad del sidebar.
//
// Por qué local y no GET /api/v1/demos:
//   - El catálogo es fijo en el código: los 4 demos están preestablecidos,
//     no son datos que cambien por usuario o tenant.
//   - El icono (Lucide name) es decisión del FRONTEND — no le pedimos al
//     backend que sepa de iconos. Eso acopla el backend a la lib UI.
//   - Si durante una demo en vivo el backend se cae, el sidebar igual carga
//     — el cliente ve "agente_no_disponible" en vez de "app rota".
//
// Los títulos y taglines vienen de i18n (`t('demos.<id>.title')`), así el
// switch ES/EN del header los traduce sin tocar este archivo.
// -----------------------------------------------------------------------------

import type { DemoId } from '@/lib/api';
import type { StringKey, T } from '@/lib/i18n';

/**
 * Estado del demo desde el punto de vista de la UI:
 *   - 'live'         — el demo tiene UI funcional, está navegable.
 *   - 'coming-soon'  — la UI no existe o es un teaser estático (Demo 03).
 */
export type DemoStatus = 'live' | 'coming-soon';

export interface DemoCatalogEntry {
  id: DemoId;
  /** Nombre Lucide (kebab-case) del icono — se resuelve en runtime. */
  icon: string;
  status: DemoStatus;
  /** Ruta Next.js. El sidebar la usa para navegar y matchear el activo. */
  route: string;
}

/**
 * Orden importa: es el orden de pintado en el sidebar.
 *
 * Status notes:
 *   - rag, comparator, agent: marcados 'live' — los tres tienen UI en
 *     este chain de PRs (5, 6, 7 respectivamente).
 *   - corpus: 'coming-soon' — el demo está bloqueado por la entrada de
 *     Python/FastAPI (ver docs/adr/0011-demo-03-waits-for-python.md).
 *     PR 7 va a renderizar una pantalla de teaser/roadmap.
 */
export const DEMOS_CATALOG: readonly DemoCatalogEntry[] = [
  {
    id: 'rag',
    icon: 'message-square-text',
    status: 'live',
    route: '/demo/rag',
  },
  {
    id: 'comparator',
    icon: 'git-compare-arrows',
    status: 'live',
    route: '/demo/comparator',
  },
  {
    id: 'corpus',
    icon: 'library-big',
    status: 'coming-soon',
    route: '/demo/corpus',
  },
  { id: 'agent', icon: 'bot', status: 'live', route: '/demo/agent' },
] as const;

/**
 * Entrada con campos traducidos lista para pintar en el sidebar/header.
 * Combina el catálogo estático con los strings de i18n del lenguaje actual.
 */
export interface SidebarDemoItem extends DemoCatalogEntry {
  title: string;
  tagline: string;
}

/**
 * Builder lang-aware. Llamar desde un componente con `useT()`:
 *
 *   const { t, lang } = useT();
 *   const demos = useMemo(() => buildSidebarDemos(t), [lang]);
 */
export function buildSidebarDemos(t: T): SidebarDemoItem[] {
  return DEMOS_CATALOG.map((entry) => ({
    ...entry,
    title: t(`demos.${entry.id}.title` as StringKey),
    tagline: t(`demos.${entry.id}.tagline` as StringKey),
  }));
}
