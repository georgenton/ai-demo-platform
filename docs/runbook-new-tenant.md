# Runbook — Cómo crear un cliente nuevo (tenant)

Procedimiento operativo para dar de alta un cliente nuevo en la
plataforma SaaS multi-tenant. Lo ejecuta el **superadmin** (Jorge o
Edguitar con guía técnica).

> Este runbook asume que ya están mergeados los PRs del sprint
> multi-tenancy (ver [ADR-0013](./adr/0013-multi-tenant-saas-architecture.md)
> y [ADR-0014](./adr/0014-auth-email-password-jwt.md)).

---

## Antes de empezar — qué información necesitas del cliente

Pide al cliente estos datos antes de crear el tenant:

1. **Nombre legal** (display name): "Universidad UTPL", "Banco
   Pichincha", "Estudio Andrade & Asociados".
2. **Slug corto** (para URLs y logs): `utpl`, `pichincha`, `andrade`.
   Sin espacios, minúsculas, sin acentos.
3. **Industry** del cliente: una de
   `universidad | banca | legal | salud | gobierno | retail`. Si no
   encaja en ninguna, se discute con Jorge antes de crear una nueva.
4. **Email y nombre del admin del cliente:** la persona que va a
   administrar usuarios del lado del cliente.
5. **Branding (opcional):**
   - Logo en PNG transparente, 300×80 px aproximado.
   - Color de acento en hex (ej. `#003366` para banca, `#005f3b`
     para universidad).
6. **Modo del tenant:** `trial` (por default, 60 días) o `active`
   (cliente que ya firmó contrato).

---

## Paso 1 — Crear el tenant en la base de datos

Desde la máquina con acceso a la DB de producción:

```bash
# Sigue las instrucciones del runbook-deploy.md para conectarte a la DB
# de Railway o al NAI on-prem según el caso.

# Si el cliente arrancará en Railway production
npm run db:seed:railway -- --create-tenant \
  --slug "utpl" \
  --display-name "Universidad UTPL" \
  --industry "universidad" \
  --admin-email "rector@utpl.edu.ec" \
  --admin-name "María Rodríguez" \
  --status "trial"
```

El script:

1. Inserta una fila en `Tenant` con la industry vinculada.
2. Crea un `User` con role `admin` y una contraseña aleatoria
   temporal (16 chars).
3. Muestra en consola la **contraseña temporal**. Esta se entrega al
   cliente por canal seguro (NO email plano).
4. Si `branding` no se pasó, hereda los defaults de la industry.

**Output esperado:**

```
✓ Tenant created: utpl (id: clx9e8...)
✓ Industry linked: universidad (3 demos enabled: rag, comparator, agent)
✓ Admin user created: rector@utpl.edu.ec
✓ Temporary password: kF92mNxQa7vR2Lp8
⚠ ENTREGA LA CONTRASEÑA AL CLIENTE POR CANAL SEGURO.
⚠ El admin debe cambiarla en el primer login (futuro M2).
```

---

## Paso 2 — Cargar documentos seed de la industria (opcional)

Cada industry tiene un set de documentos seed que aceleran el
time-to-value. Por ejemplo, para una universidad: un reglamento
académico ejemplar, un manual de matrículas, una política de
propiedad intelectual.

```bash
npm run tenant:load-seed -- --tenant "utpl" --industry-defaults
```

El script lee los documentos en
`packages/db/prisma/seed-demos-data/<industry>/` y los indexa contra
el tenant nuevo. Embeddings se generan con el LLMAdapter actual.

**Si el cliente prefiere arrancar limpio:** omite este paso. El
admin puede subir sus propios documentos desde la UI.

---

## Paso 3 — Customizar branding (opcional)

Si el cliente entregó logo y color de acento:

```bash
npm run tenant:set-branding -- --tenant "utpl" \
  --logo-url "https://nai-cdn.local/utpl-logo.png" \
  --accent-color "#005f3b"
```

El logo se sube primero al storage (Vercel Blob público o equivalente
on-prem) y luego se referencia la URL. El branding se almacena en la
columna `Tenant.branding` como JSON:

```json
{
  "logoUrl": "https://nai-cdn.local/utpl-logo.png",
  "accentColor": "#005f3b",
  "displayName": "Universidad UTPL"
}
```

---

## Paso 4 — Verificar el dashboard del cliente

1. Ve a la URL del SaaS (`https://app.nai-platform.com` o equivalente).
2. Inicia sesión con `rector@utpl.edu.ec` + la contraseña temporal.
3. Verifica que el sidebar muestra **solo los demos habilitados** por
   la industry. Para universidad: RAG, Comparator, Agent.
4. El header muestra el logo del cliente y el color de acento.
5. Si cargaste seed: los demos ya tienen documentos para consultar.

**Si algo no se ve bien:**

- Logo no aparece → verifica que la URL del CDN sea pública y
  responda HTTPS.
- Demos extra aparecen → revisa `Tenant.enabledDemos` y la industry.
- Color no aplica → asegura que el hex esté con `#` y 6 caracteres.

---

## Paso 4b — Smoke test end-to-end (post sprint MT1-MT5)

Después del alta del tenant, ejecuta esta lista para confirmar que el
flujo completo funciona antes de pasarle accesos al cliente. Si
cualquiera de los 6 pasos falla, no escribas el email del Paso 5 hasta
arreglarlo.

1. **Login del admin del cliente**
   - Abre `https://app.nai-platform.com/login` en una pestaña incógnita
     (sin cookies viejas).
   - Loguea con el email del admin que creaste en el Paso 2 y la
     contraseña temporal.
   - **Esperado:** redirige a `/` y muestra el dashboard con las cards
     de los demos habilitados del tenant.
   - **Si redirige a `/login` otra vez:** revisa que el backend tenga
     `JWT_SECRET` seteado y reiniciado tras la última deploy.

2. **Dashboard filtrado correctamente**
   - **Esperado:** solo aparecen los demos del `enabledDemos` del
     tenant (heredados de la industry o overrideados).
   - **Si aparecen demos extra:** el filtro `useMyDemos()` falló →
     revisa que `GET /api/v1/me/demos` responda 200 y el array
     `demos` coincida con la lista esperada.

3. **Branding del sidebar**
   - **Esperado:** el sidebar muestra el `branding.displayName` (o el
     `tenant.displayName` si no hay branding override), el logo del
     cliente, y el accent color en los items activos.
   - **Si no se ve el logo:** verifica que `branding.logoUrl` sea
     HTTPS y accesible (curl al URL). Si es CORS-bloqueado, el
     `<Image unoptimized>` igual debería renderizar — revisa la
     consola del browser.

4. **Acceso negado a demos no habilitados**
   - Mientras el admin del cliente está logueado, abre directamente
     `/demo/<demoId>` para un demo que NO esté en su `enabledDemos`
     (ej: si es un tenant universidad sin tutor habilitado, prueba
     `/demo/tutor`).
   - **Esperado:** el endpoint protegido responde 403 (visible en
     DevTools Network) con mensaje "El demo X no está habilitado para
     tu organización". La página puede mostrar un estado de error o
     vacío — el `DemoAccessGuard` del backend está cumpliendo.

5. **Admin panel funcional**
   - El admin abre `/admin/tenant`.
   - **Esperado:** ve el form con `displayName`, `enabledDemos` (con
     los chequeados) y los campos de branding precargados.
   - Cambia el accent color a otro hex y guarda.
   - **Esperado:** banner "Cambios guardados", el sidebar refresca con
     el nuevo color sin reload.

6. **Aislamiento entre tenants (si hay más de un tenant en la DB)**
   - Loguea con un user del tenant A y abre DevTools.
   - Ejecuta en la consola:
     `fetch('/api/v1/documents').then(r => r.json()).then(console.log)`
   - **Esperado:** solo aparecen documentos del tenant A. Ningún doc
     del tenant B debería estar en la lista.

---

## Paso 5 — Entregar accesos al cliente

Envía al admin del cliente un email con:

1. **URL del dashboard**: `https://app.nai-platform.com/login`.
2. **Su email** como usuario.
3. **La contraseña temporal** — por canal seguro (Signal, llamada
   telefónica, o entrega en persona). NUNCA por email plano.
4. **Instrucciones para cambiar la contraseña en el primer login.**
5. **Quién es su contacto de soporte** (Edguitar para comercial,
   Jorge para técnico).
6. **Onboarding agendado** — workshop de 4 horas incluido en el
   pricing (slide 50 del deck).

---

## Paso 6 — Invitar usuarios adicionales del cliente

Una vez el admin del cliente entra, puede invitar a su equipo desde
la sección Admin del dashboard:

1. **Settings → Users → Invite**.
2. Ingresa email + rol (`member` o `admin`).
3. El sistema crea el user con contraseña temporal y se la muestra
   al admin (M2: lo envía por email).
4. El admin entrega la contraseña al usuario por canal seguro.

> **Importante:** el admin del cliente NO puede invitar fuera de su
> tenant. Solo el `superadmin` puede crear tenants nuevos.

---

## Cómo desactivar un tenant (cliente que abandona)

```bash
npm run tenant:suspend -- --tenant "utpl"
```

- Cambia el `Tenant.status` a `suspended`.
- Los users del tenant ven una pantalla "Tu cuenta está suspendida.
  Contacta a soporte." al intentar entrar.
- **Los datos NO se borran.** Si el cliente vuelve en 90 días,
  reactivas con `tenant:activate` y todo queda como estaba.
- **Si el cliente confirma baja definitiva:** después de 90 días
  ejecutas `tenant:purge` que ELIMINA todos los documents, users y
  audit logs del tenant. Operación irreversible — pide confirmación
  doble.

---

## Apéndice A — Industries soportadas

| Slug          | Display                        | Demos habilitados por default         | Seed disponible                   |
| ------------- | ------------------------------ | ------------------------------------- | --------------------------------- |
| `universidad` | Educación superior             | rag, comparator, corpus, agent, tutor | Sí (3 docs ejemplo)               |
| `banca`       | Banca y servicios financieros  | rag, comparator, agent                | Sí (regulación SEPS ejemplo)      |
| `legal`       | Estudios profesionales legales | rag, comparator, corpus               | Sí (jurisprudencia ejemplo)       |
| `salud`       | Clínicas y centros médicos     | rag, agent                            | No (cliente carga sus protocolos) |
| `gobierno`    | Sector público                 | rag, agent, tutor                     | Sí (ordenanzas ejemplo)           |
| `retail`      | Cadenas de tiendas             | rag, agent                            | No                                |

Para sumar una industry nueva: edita
`packages/db/prisma/seed-industries.ts`, suma seed data si aplica y
documenta acá.

---

## Apéndice B — Variables de entorno relevantes

| Variable            | Para qué                                       | Ejemplo                              |
| ------------------- | ---------------------------------------------- | ------------------------------------ |
| `JWT_SECRET`        | Firma de tokens. Mínimo 32 chars.              | `openssl rand -base64 48`            |
| `JWT_EXPIRES_IN`    | Duración del token.                            | `7d` (default)                       |
| `COOKIE_DOMAIN`     | Dominio para la cookie en producción.          | `.nai-platform.com`                  |
| `SUPERADMIN_EMAILS` | Emails que reciben role `superadmin` al login. | `jorge@nai.local,edguitar@nai.local` |

---

## Referencias

- [ADR-0013](./adr/0013-multi-tenant-saas-architecture.md) — Modelo
  de tenancy.
- [ADR-0014](./adr/0014-auth-email-password-jwt.md) — Auth.
- [`runbook-deploy.md`](./runbook-deploy.md) — Acceso a la DB de
  producción para los comandos de este runbook.
- Slide 47–51 del deck comercial — Para qué sirve este modelo.
