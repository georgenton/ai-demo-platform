// Tipos espejo de los endpoints /api/v1/demos.
// Ver ADR-0010 para la decisión de duplicar tipos vs paquete compartido.

import type { DemoId } from './types';

export type DemoStatus = 'available' | 'coming-soon';

/** Espejo de DemoMetadata (apps/api/.../demo-registry.types.ts). */
export interface DemoMetadata {
  id: DemoId;
  title: string;
  tagline: string;
  description: string;
  audience: string[];
  status: DemoStatus;
  /** Ruta del frontend donde vive el demo, ej. '/demo/rag'. */
  route: string;
}
