// -----------------------------------------------------------------------------
// Cliente Prisma — el punto único por el que la app habla con Postgres.
//
// Patrón singleton: una sola instancia para toda la app. ¿Por qué importa?
//   Cada `new PrismaClient()` abre un pool de conexiones a Postgres. En dev,
//   el hot-reload de NestJS/Next.js re-ejecuta los módulos muchas veces — sin
//   cache, el pool se agota en minutos.
//
// La cache vive en `globalThis` (sobrevive al re-import del módulo).
// En producción NO usamos cache global: cada proceso arranca limpio y se va.
// -----------------------------------------------------------------------------

import { PrismaClient } from '../../generated/client/client.js';

// Re-exports útiles: consumidores (apps/api, etc.) acceden a los tipos de
// modelo y al namespace Prisma directamente desde '@org/db'.
export { Prisma } from '../../generated/client/client.js';
export type { Chunk, Document } from '../../generated/client/client.js';

// Tipado mínimo para colgar el singleton de `globalThis` sin pelearse con TS.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Reutiliza la instancia cacheada si existe; si no, crea una nueva.
export const prisma = globalForPrisma.prisma ?? new PrismaClient();

// Solo cacheamos en dev. En prod cada proceso es corto y vale arrancar limpio.
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
