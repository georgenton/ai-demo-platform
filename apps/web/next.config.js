//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next');

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 *
 * El proxy al backend NestJS vive en `apps/web/src/app/api/[...path]/route.ts`
 * (Route Handler de Next, no `rewrites()`). Razón: necesitamos inyectar
 * `X-Internal-Key` server-side cuando el backend está deployado en Railway
 * — los rewrites no pueden agregar headers. El handler también deja
 * funcionar el dev local sin INTERNAL_API_KEY (el guard del backend queda
 * inactivo si la env var está vacía).
 *
 * BACKEND_URL apunta al backend:
 *   - dev/local: http://localhost:3000 (default si no se setea)
 *   - prod: la URL pública de Railway (ej: https://ai-demo-api.up.railway.app)
 */
const nextConfig = {
  // Use this to set Nx-specific options
  // See: https://nx.dev/recipes/next/next-config-setup
  nx: {},
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
