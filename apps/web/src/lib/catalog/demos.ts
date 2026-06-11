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
  /**
   * Keys i18n para el público objetivo del demo. Cada página las resuelve
   * via `useT()` y las pinta en el AudienceLine del header. Mantener en
   * sync con `DemoRegistryService.audience` del backend (mismo orden,
   * mismas strings) — los dos lados se editan en el mismo PR.
   */
  audienceKeys: readonly StringKey[];
}

/**
 * Orden importa: es el orden de pintado en el sidebar.
 *
 * Status notes:
 *   - rag, comparator, agent: marcados 'live' — los tres tienen UI en
 *     el chain de PRs original (5, 6, 7 respectivamente).
 *   - corpus: ahora también 'live' — el Demo 03 entró funcional vía el
 *     sprint Demo 03 (PRs #42-#46). La versión con Python/FastAPI sigue
 *     siendo el target final, pero la versión con LLM APIs + pgvector
 *     que ya tenemos es suficiente para una demo seria.
 *   - tutor: 'coming-soon' por ahora — sprint Demo 05 en curso. La UI
 *     deshabilita la card mientras se construye. Ver ADR-0012.
 */
export const DEMOS_CATALOG: readonly DemoCatalogEntry[] = [
  {
    id: 'rag',
    icon: 'message-square-text',
    status: 'live',
    route: '/demo/rag',
    audienceKeys: [
      'audience.rag.universities',
      'audience.rag.hr',
      'audience.rag.legal',
    ],
  },
  {
    id: 'comparator',
    icon: 'git-compare-arrows',
    status: 'live',
    route: '/demo/comparator',
    audienceKeys: [
      'audience.cmp.legal',
      'audience.cmp.procurement',
      'audience.cmp.audit',
    ],
  },
  {
    id: 'corpus',
    icon: 'library-big',
    status: 'live',
    route: '/demo/corpus',
    audienceKeys: ['audience.corpus.research', 'audience.corpus.gradschool'],
  },
  {
    id: 'agent',
    icon: 'bot',
    status: 'live',
    route: '/demo/agent',
    audienceKeys: [
      'audience.agent.cio',
      'audience.agent.rectorado',
      'audience.agent.academic',
    ],
  },
  {
    id: 'tutor',
    icon: 'graduation-cap',
    status: 'live',
    route: '/demo/tutor',
    audienceKeys: [
      'audience.tutor.langCenters',
      'audience.tutor.corporate',
      'audience.tutor.cio',
    ],
  },
  {
    // Demo 06 — asistente clínico (ADR-0016). Sidebar lo muestra solo para
    // tenants de industria 'salud'; el filtrado se hace en el shell con
    // el `enabledDemos` que viene de `/me/demos`.
    id: 'clinical',
    icon: 'stethoscope',
    status: 'live',
    route: '/demo/clinical',
    audienceKeys: [
      'audience.clinical.directors',
      'audience.clinical.heads',
      'audience.clinical.cio',
    ],
  },
  {
    // Demo 07 — avatar entrevistador HR (ADR-0017). Cross-industry: el sidebar
    // lo muestra para los tenants cuyo `enabledDemos` (de /me/demos) incluye
    // 'interview' (universidad, banca, retail, gobierno — no salud, no legal).
    // Icon `circle-user` representa al candidato (más HR-friendly que `mic`).
    id: 'interview',
    icon: 'circle-user',
    status: 'live',
    route: '/demo/interview',
    audienceKeys: [
      'audience.interview.hr',
      'audience.interview.selection',
      'audience.interview.admissions',
    ],
  },
  {
    // Demo 08 — notarización cooperativa con IA (ADR-0019). Cross-industry,
    // pero el caso seed son cooperativas de ahorro y crédito en Ecuador
    // (SEPS / LOEPS). Icon `shield-check` representa la combinación
    // notarizado + verificable.
    id: 'notarize',
    icon: 'shield-check',
    status: 'live',
    route: '/demo/notarize',
    audienceKeys: [
      'audience.notarize.gerentes',
      'audience.notarize.compliance',
      'audience.notarize.auditores',
    ],
  },
] as const;

/**
 * Helper para obtener las audiencias traducidas de un demo. Las páginas
 * suelen llamarlo así:
 *
 *   const { t } = useT();
 *   const audience = useDemoAudience('rag', t);  // → ['Universidades', 'RRHH', …]
 *
 * Devuelve un array vacío si el demoId no existe (no debería pasar — el
 * catálogo cubre todos los DemoId del union literal).
 */
export function getDemoAudience(demoId: DemoId, t: T): string[] {
  const entry = DEMOS_CATALOG.find((e) => e.id === demoId);
  if (!entry) return [];
  return entry.audienceKeys.map((key) => t(key));
}

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
