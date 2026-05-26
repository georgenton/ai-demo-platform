//@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next');

/**
 * Backend NestJS al que proxeamos las llamadas del frontend.
 * En desarrollo corre en localhost:3000 (ver `nx serve api`).
 * En otros entornos se sobreescribe con la variable de entorno
 * API_PROXY_TARGET.
 *
 * Por qué proxy y no llamada directa con CORS:
 *   - El browser ve a Next.js y a la API como el mismo origen (`/api/...`).
 *     No hay preflight CORS, no hay que configurar dominios en el backend.
 *   - El cliente del frontend usa URLs relativas (`/api/v1/...`) — no
 *     necesitamos NEXT_PUBLIC_API_BASE_URL ni distinguir entornos en el
 *     código del browser.
 */
const API_PROXY_TARGET =
  process.env.API_PROXY_TARGET ?? 'http://localhost:3000';

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  // Use this to set Nx-specific options
  // See: https://nx.dev/recipes/next/next-config-setup
  nx: {},

  /**
   * Rewrites: cuando el browser pide `/api/v1/...`, Next.js lo reenvía al
   * backend NestJS de forma transparente. El cliente nunca ve el host real
   * del backend.
   *
   * Importante: usamos `:path*` (catch-all) para que rutas anidadas como
   * `/api/v1/ingest/file` también se proxeen sin listarlas una a una.
   */
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_PROXY_TARGET}/api/:path*`,
      },
    ];
  },
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
