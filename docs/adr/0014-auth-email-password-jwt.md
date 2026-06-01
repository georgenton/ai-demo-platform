# ADR-0014 — Auth: email + contraseña con JWT en cookie httpOnly

- **Estado:** Propuesto · pendiente de aprobación de Jorge
- **Fecha:** 2026-05-29
- **Decisores:** Jorge
- **Relacionado:**
  - [`ADR-0013`](./0013-multi-tenant-saas-architecture.md) — el
    multi-tenancy requiere una estrategia de auth concreta
  - Slide 47–51 del `nai-deck.pptx` — sección comercial del SaaS

## Contexto

Hoy la app se protege con **HTTP Basic Auth** a nivel de Vercel
(usuario `demo`, password `demo` en staging). Eso fue suficiente para
proteger el preview deploy de una demo a un cliente; no sirve para un
SaaS multi-tenant donde:

- Cada cliente tiene varios usuarios con identidades distintas.
- Cada usuario debe poder cambiar su contraseña sin tocar variables
  de entorno.
- El backend necesita saber **quién** está consultando para aplicar
  el filtro de tenant (`ADR-0013`).
- El audit log debe registrar `userId` y `tenantId` en cada acción.

La auth es la piedra angular del multi-tenancy. Sin identificar al
usuario, no hay forma de aislar datos.

## Decisión

Adoptamos **email + contraseña** con almacenamiento via **bcrypt**, y
sesiones mediante **JWT firmado** que viaja en una **cookie
httpOnly + SameSite=Strict**.

**Cuatro piezas:**

1. **Hashing de contraseñas: bcrypt (cost 12)**. Estándar de la
   industria. `bcryptjs` para evitar binarios nativos en Vercel.
2. **JWT como sesión:** payload `{ sub: userId, tenantId, role }`,
   firmado con HS256 y `JWT_SECRET` de 32+ caracteres en env var.
   Expiración 7 días con refresh automático en cada request.
3. **Cookie httpOnly + Secure + SameSite=Strict:** evita XSS robar
   el token (no es accesible desde JS) y bloquea CSRF (no se manda
   en requests cross-origin).
4. **Login endpoint en NestJS:** `POST /api/v1/auth/login` con
   `class-validator` para el body, response setea la cookie. No hay
   token en localStorage ni Authorization header — siempre cookie.

**Tres endpoints públicos** (no requieren auth):

- `POST /api/v1/auth/login` — recibe email + password, valida,
  setea cookie, devuelve `{ user, tenant }`.
- `POST /api/v1/auth/logout` — limpia la cookie. Idempotente.
- `GET /api/v1/auth/me` — devuelve el user logueado o 401.

**Resto de endpoints protegidos** con `AuthGuard` global que:

1. Lee la cookie `auth`.
2. Verifica el JWT con `JWT_SECRET`.
3. Si válido, inyecta `request.user = { id, tenantId, role }`.
4. Si inválido o ausente, devuelve 401.

El `TenantGuard` corre después y usa `request.user.tenantId`. No
acepta `tenantId` por query string ni header — solo del JWT, lo cual
elimina la clase de bug "user pide tenantId ajeno en URL".

## Alternativas consideradas

### A — Magic link por email (sin contraseña)

Cliente recibe un link único por email, lo abre, queda logueado.

- **Pros:** UX moderno, cero contraseñas que rotar, menos soporte.
- **Contras:**
  - Requiere SMTP configurado y dominio verificado.
  - Si el email no llega (spam, server down), bloquea totalmente al
    usuario.
  - Cada login requiere ir al inbox — fricción para uso diario.
  - Universidades suelen tener filtros de email estrictos que comen
    los magic links.
- **Por qué se rechazó:** demasiado dependiente de infraestructura
  externa para una arquitectura on-prem. Si NAI corre detrás del
  firewall del cliente, el SMTP también debe estar dentro — sumar esa
  pieza no aporta valor proporcional al riesgo.

### B — SSO SAML / OIDC (Active Directory, Google Workspace)

El cliente conecta su directorio corporativo. Los usuarios entran
con sus credenciales institucionales.

- **Pros:** la mejor UX empresarial. Cero contraseñas adicionales.
  Reset de empleado en su directorio = baja en la app
  automáticamente.
- **Contras:**
  - Configurar SAML/OIDC con cada cliente es 1-2 días de trabajo
    por integración.
  - Requiere que el cliente tenga directorio compatible. Muchas
    cooperativas pequeñas y universidades pequeñas no lo tienen.
  - Librerías de SAML en NestJS son delicadas — bugs caros.
- **Por qué se rechazó AHORA:** overkill para clientes pequeños y
  medianos del target inicial. **Se vuelve a evaluar** cuando entre
  el primer cliente con directorio corporativo (banca grande).
  Mientras tanto, la app soporta SSO como tier "Enterprise"
  (slide 50 del deck).

### C — Auth0 / Clerk / Vercel Sign In as a Service

Usar un proveedor externo de identidad.

- **Pros:** menos código que mantener, social login fácil, MFA
  incluido.
- **Contras:**
  - Costo recurrente (Auth0 desde USD 240/mes a poco volumen).
  - **Datos de usuarios viajan al proveedor.** Contradice el pitch
    on-prem del producto. Sería incoherente con la sección 6 del
    deck.
  - Lock-in: cambiar de proveedor implica migrar usuarios.
- **Por qué se rechazó:** mata el discurso comercial. NAI on-prem +
  Auth0 cloud no compite con NAI on-prem 100% local.

### D — Mantener Basic Auth con users por tenant

Extender el basic auth actual con un map `email:hash` en una env var
gigante.

- **Pros:** muy poco código.
- **Contras:**
  - Cambiar password de un usuario = redeploy del backend.
  - Sin sesión, cada request manda credenciales — más superficie
    para captura.
  - No hay JWT con `tenantId` — el filtro de tenant tendría que
    leer DB en cada request, +1 query por endpoint.
- **Por qué se rechazó:** "fácil hoy, doloroso a 10 tenants".

### Opción elegida — Email/password + JWT en cookie

Equilibra simplicidad, seguridad, costo y autonomía. Funciona en
on-prem sin dependencias cloud. Permite que el cliente administre
sus usuarios sin que Edguitar redeploye nada. Deja la puerta abierta
a sumar SSO como tier Enterprise sin reescribir.

## Flujo concreto

```
Browser                          Backend                        DB
   │                                │                            │
   │  POST /auth/login              │                            │
   │  { email, password }           │                            │
   ├───────────────────────────────►│                            │
   │                                │  findUserByEmail(email)    │
   │                                ├───────────────────────────►│
   │                                │◄─────────────── user + hash│
   │                                │                            │
   │                                │  bcrypt.compare(pw, hash)  │
   │                                │  signJwt({ uid, tid, role})│
   │                                │  setCookie('auth', jwt)    │
   │                                │                            │
   │◄───────────────────────────────┤                            │
   │  200 + Set-Cookie: auth=…      │  body: { user, tenant }    │
   │                                │                            │
   │  GET /api/v1/documents         │                            │
   │  Cookie: auth=…                │                            │
   ├───────────────────────────────►│                            │
   │                                │  AuthGuard verifica JWT    │
   │                                │  TenantGuard inject tid    │
   │                                │  documents.findMany({tid}) │
   │                                ├───────────────────────────►│
   │                                │◄───────────── docs del tid │
   │◄───────────────────────────────┤                            │
   │  200 + body                    │                            │
```

## Implementación esperada

### Backend (NestJS)

```ts
// apps/api/src/app/auth/auth.module.ts
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET, // 32+ chars, validado en env.schema
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, TenantGuard],
  exports: [AuthService, AuthGuard, TenantGuard],
})
export class AuthModule {}

// apps/api/src/app/auth/auth.guard.ts
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const token = req.cookies['auth'];
    if (!token) throw new UnauthorizedException();
    const payload = this.jwt.verify(token);
    req.user = payload; // { sub, tenantId, role }
    return true;
  }
}

// Aplicado global en apps/api/src/main.ts (excepto auth/* endpoints)
app.useGlobalGuards(new AuthGuard(jwtService));
```

### Frontend (Next.js)

- **Middleware** `apps/web/middleware.ts` que protege todas las rutas
  salvo `/login` y `/api/auth/*`.
- **Auth context** que mantiene `user` y `tenant` en memoria del
  cliente; lo refresca en cada navegación leyendo `GET /auth/me`.
- **Login page** `/login` con form mínimo y feedback de errores.
- **Logout** disponible desde el sidebar.

### Cookies en preview vs producción

- **Producción / staging (HTTPS):** `Secure: true`, `SameSite: 'strict'`.
- **Local (HTTP):** `Secure: false`, `SameSite: 'lax'`. El env-schema
  decide en runtime según `NODE_ENV`.

## Consecuencias

### Positivas

- **Cada user logueado lleva su `tenantId` en el JWT.** El backend
  no consulta DB para saber a qué tenant pertenece — ya lo sabe.
- **Tests fáciles.** Un helper `loginAs(userId)` que setea la cookie
  alcanza para cualquier test E2E.
- **Cero dependencias externas.** Funciona on-prem dentro del NAI sin
  conexión a internet.
- **Onboarding seguro.** El admin del cliente invita a usuarios con
  un endpoint que envía email con link de "set password" (M2 del
  sprint).

### Negativas / costos

- **Sin MFA en el sprint inicial.** Si un cliente lo exige, se suma
  con TOTP (Google Authenticator) en una iteración posterior — la
  base ya queda lista.
- **Reset de contraseña requiere email.** El sprint inicial usa un
  endpoint admin "reset password" que el superadmin ejecuta. El
  endpoint "forgot password" con email se suma cuando entre SMTP.
- **JWT secret en env var.** Si se filtra, todos los tokens son
  inválidos hasta rotar. Documentado en el runbook.

### Riesgos / cosas a vigilar

- **JWT_SECRET débil.** Validado en `env.schema` con mínimo 32 chars.
- **Cookie sin Secure en producción.** Bloqueado por el env-schema.
- **Tokens robados que no expiran.** Mitigado por expiración 7 días.
  Si un cliente reporta credenciales comprometidas, rotamos el
  JWT_SECRET (invalida TODOS los tokens) — bruto pero efectivo.
- **No hay rate limiting.** Sprint M2: aplicar `@nestjs/throttler` a
  `/auth/login` (5 intentos por minuto por IP).

## Cuándo revisar

- **Cuando entre el primer cliente con directorio corporativo
  grande** (banca + de 500 empleados con Active Directory). Sumar SSO
  como tier Enterprise.
- **Cuando un cliente exija MFA** (típicamente banca o salud).
- **Si una vulnerabilidad en JWT/bcrypt aparece** en CVE — chequeo
  trimestral del runbook.

## Referencias

- [ADR-0013](./0013-multi-tenant-saas-architecture.md) — el
  multi-tenancy que esta auth habilita.
- [OWASP — Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [bcryptjs npm](https://www.npmjs.com/package/bcryptjs) — librería
  elegida (sin binarios nativos, compatible con Vercel).
- [JWT Best Practices RFC 8725](https://datatracker.ietf.org/doc/html/rfc8725)
