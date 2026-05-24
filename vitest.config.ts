// -----------------------------------------------------------------------------
// Configuración de Vitest para TODO el monorepo (un solo archivo en la raíz).
//
// Vitest es el "corredor de tests": busca los archivos *.test.ts / *.spec.ts,
// los ejecuta y avisa si algo falla. Es la "alarma" que suena si rompes algo.
//
// Por ahora montamos solo la infraestructura — los tests concretos se escriben
// selectivamente sobre la lógica delicada (chunking, RAG) cuando lleguemos a ella.
// -----------------------------------------------------------------------------

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 'node' = entorno de ejecución de los tests. Nuestro backend corre en Node.
    // (Si más adelante testeamos componentes React, agregamos el entorno 'jsdom'.)
    environment: 'node',

    // Permite que `npm test` pase con éxito aunque TODAVÍA no haya tests escritos.
    // Sin esto, el CI fallaría solo por no tener tests — y aún no toca escribirlos.
    passWithNoTests: true,

    // Excluye archivos compilados (dist/), node_modules y el caché de Nx.
    // Sin esto, Vitest correría los tests dos veces: el .ts fuente Y el .js
    // compilado que termina en .nx/cache/...; las dobles ejecuciones rompen
    // los mocks que dependen de hoisting.
    //
    // Los integration tests (*.integration.test.ts) también se excluyen del
    // run default — son lentos (levantan containers) y corren aparte con
    // `npm run test:integration`. Eso mantiene el dev-loop ágil.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.nx/**',
      '**/*.integration.test.ts',
    ],
  },
});
