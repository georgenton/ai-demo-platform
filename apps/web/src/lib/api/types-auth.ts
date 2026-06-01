// -----------------------------------------------------------------------------
// Tipos del módulo de autenticación — espejo de los DTOs de apps/api/auth.
//
// ADR-0010 declaró "no contracts pkg compartido": preferimos duplicar tipos
// manualmente en el frontend para conservar bajo acoplamiento y deploys
// independientes. Cuando un DTO del backend cambia, también editamos su
// gemelo acá y los tests cazan el drift.
//
// Espejados de:
//   - apps/api/src/app/auth/dto/login.dto.ts
//   - apps/api/src/app/auth/auth.types.ts (AuthResponse)
//   - apps/api/src/app/me/dto/me-demos-response.dto.ts
// -----------------------------------------------------------------------------

/** Roles posibles del usuario. Sin enum runtime — solo tipo. */
export type UserRole = 'superadmin' | 'admin' | 'member';

/** Status del tenant. */
export type TenantStatus = 'active' | 'trial' | 'suspended';

/** Body del POST /api/v1/auth/login. */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Respuesta de POST /auth/login y GET /auth/me. */
export interface AuthResponse {
  user: {
    id: string;
    email: string;
    displayName: string;
    role: UserRole;
  };
  tenant: {
    id: string;
    slug: string;
    displayName: string;
    industry: {
      slug: string;
      displayName: string;
    };
    branding: unknown;
    status: TenantStatus;
  };
}

/** Resumen visible del tenant en GET /me/demos. */
export interface MeTenantInfo {
  id: string;
  slug: string;
  displayName: string;
  branding: unknown;
  status: TenantStatus;
}

/** Resumen visible del industry en GET /me/demos. */
export interface MeIndustryInfo {
  slug: string;
  displayName: string;
  defaultConfig: unknown;
}

/** Demo del catálogo — copia del tipo del backend (types-demos.ts ya
 *  tiene este shape, lo re-exportamos para evitar imports cruzados). */
export interface MeDemo {
  id: string;
  title: string;
  tagline: string;
  description: string;
  audience: string[];
  status: 'available' | 'coming-soon';
  route: string;
}

/** Respuesta del GET /api/v1/me/demos. */
export interface MeDemosResponse {
  tenant: MeTenantInfo;
  industry: MeIndustryInfo;
  demos: MeDemo[];
  /** true si Tenant.enabledDemos sobreescribió Industry.enabledDemos. */
  overridden: boolean;
}
