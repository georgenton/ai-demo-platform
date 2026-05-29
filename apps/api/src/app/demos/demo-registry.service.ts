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
        'Sube dos o más documentos, elige las dimensiones a comparar (cláusulas, riesgos, diferencias) y obtén una tabla comparativa con las fuentes citadas.',
      audience: ['Legal', 'Compras', 'Auditoría'],
      status: 'available',
      route: '/demo/comparator',
    },
    {
      id: 'corpus',
      title: 'Analizador de corpus académico',
      tagline: 'Detecta tendencias en colecciones de tesis y papers',
      description:
        'Carga tesis o papers en PDF y obtén estadísticas agregadas (papers por año, tópicos dominantes), búsqueda semántica sobre todo el corpus y un resumen ejecutivo del estado del arte generado por LLM.',
      audience: ['Vicerrectorado de investigación', 'Posgrado'],
      status: 'available',
      route: '/demo/corpus',
    },
    {
      id: 'agent',
      title: 'Agente con acceso a datos',
      tagline: '¿Cuántos estudiantes reprobaron Cálculo este semestre?',
      description:
        'El LLM genera SQL a partir de la pregunta y el sistema lo ejecuta contra los datos estructurados — preguntas analíticas en lenguaje natural.',
      audience: ['CIO', 'Rectorado', 'Dirección académica'],
      status: 'available',
      route: '/demo/agent',
    },
    {
      // Demo 05 — Tutor de inglés conversacional con calculadora de costo.
      // El único demo del catálogo cuya pieza diferenciadora NO son los datos
      // del cliente sino el caso de negocio "build vs buy": chat tipo Loora
      // + panel de costo en vivo que extrapola tokens a {alumnos, sesiones,
      // semanas} y lo compara con NAI on-prem ($0 variable). Ver ADR-0012.
      // Status: available desde el cierre del sprint Demo 05 (PR-E).
      id: 'tutor',
      title: 'Tutor de inglés con calculadora de costo',
      tagline: 'Conversa en inglés y mira en vivo cuánto cuesta a escala',
      description:
        'Chat conversacional para practicar inglés con corrección estructurada (gramática, léxico, versión natural), entrada/salida por voz nativa del browser y una calculadora que proyecta el costo a N alumnos × M sesiones, comparado contra Anthropic comercial vs NAI on-prem.',
      audience: [
        'Centros de idiomas universitarios',
        'Capacitación corporativa',
        'CIO evaluando build vs buy',
      ],
      status: 'available',
      route: '/demo/tutor',
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
