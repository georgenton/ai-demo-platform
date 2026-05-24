// -----------------------------------------------------------------------------
// Configuración de Vitest para los INTEGRATION TESTS.
//
// Estos tests levantan containers reales (Postgres+pgvector vía testcontainers)
// y son lentos comparados con los unit tests — por eso viven en su propia
// config y se corren con `npm run test:integration`.
//
// Convención: archivos `*.integration.test.ts`. El config default (vitest.config.ts)
// los excluye, así el `npm test` regular sigue siendo rápido.
// -----------------------------------------------------------------------------

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.integration.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.nx/**'],
    // Las pruebas de integración suelen necesitar más tiempo:
    //   - hooks (beforeAll con container startup + migraciones) → hookTimeout.
    //   - cada test (queries reales contra Postgres) → testTimeout.
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});
