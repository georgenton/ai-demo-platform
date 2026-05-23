// @ts-check
// -----------------------------------------------------------------------------
// Configuración de ESLint para TODO el monorepo (un solo archivo en la raíz).
//
// ESLint es el "corrector mientras escribes": detecta errores reales del código
// (variables sin usar, promesas sin await, tipos mal usados), no de formato
// — del formato se encarga Prettier.
//
// Esto usa el formato "flat config", el estándar desde ESLint 9: se exporta un
// array donde cada bloque {} aplica ciertas reglas a ciertos archivos.
// -----------------------------------------------------------------------------

import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// tseslint.config() es solo un ayudante que da autocompletado y valida la forma.
export default tseslint.config(
  // 1) Qué NO revisar: código compilado, dependencias, caché y archivos generados.
  {
    ignores: [
      '**/dist',
      '**/node_modules',
      '**/.next',
      '**/.nx',
      '**/out-tsc',
      '**/next-env.d.ts', // lo regenera Next.js en cada build — no se toca
      '**/*.config.*', // archivos de config (webpack, next, vitest…) en JS
      '**/generated', // código generado (Prisma client, etc.)
    ],
  },

  // 2) Reglas base de JavaScript recomendadas por el equipo de ESLint.
  js.configs.recommended,

  // 3) Reglas recomendadas de TypeScript. Aquí está el mayor valor:
  //    detectan los errores típicos de TS antes de ejecutar el código.
  ...tseslint.configs.recommended,
);
