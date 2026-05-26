// -----------------------------------------------------------------------------
// DemoRegistryService — "la cartelera" del sistema.
//
// Mantiene el catálogo de demos en memoria. Por qué en memoria y no en DB:
//   - El catálogo cambia con el código, no con datos de usuarios. Persistirlo
//     en Postgres sería complejidad especulativa (regla #5 de CLAUDE.md).
//   - Cuando agregamos Demo 02/03/04, lo registramos editando este archivo y
//     el endpoint los devuelve solo. Si en algún momento se vuelve dinámico
//     (feature flags por cliente, multi-tenant), migramos a DB.
//
// El array es `readonly` y los items se devuelven directamente. Hoy nadie los
// muta porque solo los consumimos para serializar a JSON, así que no
// invertimos en clonado defensivo.
// -----------------------------------------------------------------------------

import { Injectable } from '@nestjs/common';

import type { DemoMetadata } from './demo-registry.types.js';

@Injectable()
export class DemoRegistryService {
  /**
   * Fuente de verdad del catálogo. El orden importa — es el orden en que la
   * UI los va a mostrar (Demo 01 primero porque es el que se demuestra hoy).
   */
  private readonly demos: readonly DemoMetadata[] = [
    {
      id: 'rag',
      title: 'Chat con documentos',
      tagline: 'Chatea con el reglamento académico de tu universidad',
      description:
        'Sube un PDF (reglamento, manual, contrato) y pregunta en lenguaje natural. El sistema indexa el documento, busca los fragmentos relevantes y responde citando la fuente exacta.',
      audience: ['Universidades', 'RRHH', 'Áreas legales'],
      status: 'available',
      route: '/demo/rag',
    },
    {
      id: 'comparator',
      title: 'Comparador de documentos',
      tagline: 'Analiza dos contratos y dime las diferencias de riesgo',
      description:
        'Sube dos o más documentos, elige las dimensiones a comparar (cláusulas, riesgos, diferencias) y obtené una tabla comparativa con las fuentes citadas.',
      audience: ['Legal', 'Compras', 'Auditoría'],
      status: 'coming-soon',
      route: '/demo/comparator',
    },
    {
      id: 'corpus',
      title: 'Analizador de corpus académico',
      tagline: 'Busca tendencias en 500 tesis de los últimos 5 años',
      description:
        'Procesa colecciones grandes de documentos académicos para detectar tendencias, temas recurrentes y patrones a través del tiempo.',
      audience: ['Vicerrectorado de investigación', 'Posgrado'],
      status: 'coming-soon',
      route: '/demo/corpus',
    },
    {
      id: 'agent',
      title: 'Agente con acceso a datos',
      tagline: '¿Cuántos estudiantes reprobaron Cálculo este semestre?',
      description:
        'El LLM genera SQL a partir de la pregunta y el sistema lo ejecuta contra los datos estructurados — preguntas analíticas en lenguaje natural.',
      audience: ['CIO', 'Rectorado', 'Dirección académica'],
      // Backend listo (POST /api/v1/agent con SSE + tool use). Pasa a
      // 'available' cuando lleguen los componentes UI de Claude Design.
      status: 'coming-soon',
      route: '/demo/agent',
    },
  ];

  /** Devuelve todos los demos en el orden definido. */
  findAll(): readonly DemoMetadata[] {
    return this.demos;
  }

  /** Busca uno por ID. Devuelve `null` si no existe — el controller decide qué HTTP status mandar. */
  findOne(id: string): DemoMetadata | null {
    return this.demos.find((demo) => demo.id === id) ?? null;
  }
}
