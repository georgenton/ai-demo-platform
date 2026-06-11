# Handoff Codex — Demo 08 sub-PR 2 (Notarización · Local notarizer firmado)

> **Cómo usar este documento.** Léelo y verifica las secciones
> reproducibles. Devuelve hallazgos en el formato pedido al final.

## Qué cambia este sub-PR

Segundo sub-PR del tren ADR-0019. **Implementación real del
`LocalNotaryAdapter`** — el mini-ledger interno firmado que vive en
Postgres. Sigue siendo **solo package** — endpoints y servicios del API
viven en sub-PR 4.

### Stacked sobre sub-PR 1

Esta rama se basa en `feat/demo-08-notarize-pr-1-schema` (PR #100). Si #100 se
mergea antes, GitHub recalcula la base automáticamente.

### Archivos tocados

| Archivo                                                          | Cambio                                                                                                                                                                                                |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/notary-adapter/src/lib/crypto-utils.ts`                | Helpers: AES-256-GCM (`encryptWithMasterKey`/`decryptWithMasterKey`), RSA-PSS-2048 (`generateKeypair`/`signWithPrivateKey`/`verifySignature`), `sha256Hex`, `GENESIS_PREV_HASH`, `computeAnchorHash`. |
| `packages/notary-adapter/src/lib/crypto-utils.test.ts`           | 19 tests de los helpers (roundtrip cifrado, sign/verify cross-key, anchorHash determinismo + sensibilidad).                                                                                           |
| `packages/notary-adapter/src/lib/providers/local-notary.ts`      | Reescritura completa del stub. Implementa `anchor()` y `verify()`. Tipos estructurales `LocalNotaryDb`, `LocalAnchorRecord`, `TenantNotaryKeyRecord` para no depender de `@org/db`.                   |
| `packages/notary-adapter/src/lib/providers/local-notary.test.ts` | 14 tests con fake DB en memoria: validaciones, idempotencia de keygen, cadena de hashes, multi-tenant, verify golden path, detección de tampering.                                                    |
| `packages/notary-adapter/src/index.ts`                           | Exporta los nuevos tipos estructurales (`LocalNotaryDb`, `LocalAnchorRecord`, `TenantNotaryKeyRecord`).                                                                                               |
| `packages/notary-adapter/src/lib/notary.test.ts`                 | Quitado el test "LocalNotaryAdapter.anchor lanza no implementado" (ya está implementado). Polygon sigue stub. Tests actualizados con masterKey de 64 hex chars.                                       |
| `docs/handoffs/demo-08-notarize-sub-pr-2.md`                     | Este documento.                                                                                                                                                                                       |

### Lo que NO toca este sub-PR

- `apps/api` / `apps/web` — sin cambios.
- `PolygonNotaryAdapter` — sigue stub (sub-PR 3).
- `NotarizationModule` y endpoints REST — sub-PR 4.
- Frontend `/demo/notarize` — sub-PR 5.

## Arquitectura del LocalNotaryAdapter (resumen)

```
                       PDF subido
                            │
                            ▼  contentHash = SHA-256(binary)
            ┌───────────────────────────────────┐
            │ LocalNotaryAdapter.anchor()       │
            │                                   │
            │ 1. getOrCreateTenantKey(tenantId) │
            │    └─ genera RSA-2048 si no hay  │
            │       (cifra privada con AES-GCM │
            │        usando NOTARY_MASTER_KEY) │
            │                                   │
            │ 2. tx { read last anchor (seq desc)│
            │         sequence = (last?? -1) + 1│
            │         prev = last?.hash ?? GEN  │
            │         hash = SHA256(content||..)│
            │         sig = RSA-PSS-SHA256(hash)│
            │         INSERT LocalAnchor }      │
            │                                   │
            │ 3. return AnchorResult            │
            └───────────────────────────────────┘
```

Cualquier alteración posterior (contentHash del PDF, anchorHash en BD,
signature) rompe la verificación. La cadena `prevAnchorHash` además
detecta inserciones/borrados intermedios en el ledger.

## Cómo verificar el sub-PR

### Sección 1 — Compilación + tests

```bash
cd ~/Projects_local/ai-demo-platform
npx tsc -p packages/notary-adapter/tsconfig.lib.json
npm test                # esperado: 479/479 verde (sub-PR 1 tenía 444; +35 nuevos)
npm run lint            # esperado: sin output
```

### Sección 2 — Inspección de crypto-utils

Verificar en `packages/notary-adapter/src/lib/crypto-utils.ts`:

1. `parseMasterKey` exige hex de 64 chars (= 32 bytes); lanza con mensaje
   claro si no.
2. `encryptWithMasterKey` produce blobs base64 con shape `IV (12B) || tag
(16B) || ciphertext`.
3. `generateKeypair` usa RSA modulusLength=2048; exporta SPKI/PKCS#8 PEM.
4. `signWithPrivateKey` y `verifySignature` usan RSA-PSS con salt length 32 y
   hash SHA-256.
5. `computeAnchorHash` concatena con `:` separadores (no concatenación
   plana — evita ambigüedad).
6. `GENESIS_PREV_HASH = sha256("notary-genesis-v1")`.

### Sección 3 — Inspección del LocalNotaryAdapter

`packages/notary-adapter/src/lib/providers/local-notary.ts`:

1. Constructor valida la master key (delega a `parseMasterKey`).
2. `anchor()`:
   - Valida `contentHash`, `tenantId`, `documentId`.
   - Llama `getOrCreateTenantKey()` FUERA de la tx (generar RSA es lento).
   - Abre tx interactiva, lee el último anchor del tenant, calcula
     sequence + prev + hash + signature, INSERT.
   - Devuelve `AnchorResult` con `provider='local'`, `status='confirmed'`,
     y `details` con sequence/prevAnchorHash/anchorHash/signerKeyId/algorithm.
3. `verify()`:
   - Devuelve `valid: false` (no lanza) con razón clara en cada negative
     case: anchorId vacío, contentHash mal formado, anchor no encontrado,
     contentHash no matchea, key inexistente, firma inválida.
4. Tipos estructurales `LocalNotaryDb`, `LocalAnchorRecord`,
   `TenantNotaryKeyRecord` definidos en el mismo archivo — el adapter NO
   importa de `@org/db`.

### Sección 4 — Cobertura de tests del Local

`local-notary.test.ts` (14 tests):

- Master key longitud incorrecta → lanza.
- Validaciones de inputs en `anchor()` (3 tests).
- `getOrCreateTenantKey` idempotente (segundo anchor del mismo tenant reusa
  la keypair).
- Primer anchor del tenant: sequence=0 + prevHash=GENESIS.
- Cadena: 3 anchors consecutivos forman la cadena (prev[N] = hash[N-1]).
- Multi-tenant: dos tenants tienen sequences independientes arrancando en 0.
- `verify` del recién creado → valid=true.
- `verify` con contentHash alterado → valid=false con razón.
- `verify` con firma alterada → valid=false.
- `verify` de anchor inexistente → valid=false con razón.
- `verify` con inputs malformados → valid=false con razones específicas.

`crypto-utils.test.ts` (19 tests):

- `parseMasterKey` validaciones.
- AES-256-GCM roundtrip, IV random, cross-key rejection, tampering.
- RSA keypair shape correcto, fingerprints únicos.
- Sign/verify roundtrip, cross-key rejection, firmas probabilísticas (PSS).
- `computeAnchorHash` determinismo + sensibilidad a cada input.

### Sección 5 — Comportamiento esperado en producción (sub-PR 4 lo expondrá)

Cuando el sub-PR 4 lo conecte al `NotarizationService`:

1. Operador setea `NOTARY_MASTER_KEY` en Railway (`openssl rand -hex 32`).
2. Al primer anchor de cada cooperativa, el adapter genera la keypair y
   guarda en `TenantNotaryKey`.
3. Cada anchor:
   - Persiste en `LocalAnchor` con sequence monotónico por tenant.
   - Forma cadena (prevAnchorHash) que detecta alteraciones.
   - Firma RSA-PSS verifica autenticidad incluso si la BD se compromete
     (atacante necesitaría la master key además).
4. La verificación es offline: con `publicKeyPem` del tenant + los campos
   del anchor, cualquiera puede recalcular el hash + verificar la firma
   sin acceso a la BD.

## Lo que necesito que Codex me reporte

Devuelve un único bloque markdown con estas secciones literales:

### Sección A — Compilación local

- `tsc notary-adapter` salida.
- `npm test` salida (resumen, # tests).
- `npm run lint` salida.

### Sección B — crypto-utils

- AES-256-GCM con IV 12 bytes / tag 16 bytes.
- RSA modulusLength=2048, PKCS#8/SPKI PEM.
- RSA-PSS con salt length 32, hash SHA-256.
- `GENESIS_PREV_HASH = sha256("notary-genesis-v1")`.

### Sección C — LocalNotaryAdapter

- Constructor valida master key.
- `anchor()` valida inputs antes de tocar BD.
- `getOrCreateTenantKey` se llama FUERA de la transacción.
- Tx lee `findFirst(orderBy: sequence desc)` y luego `create`.
- `verify()` NO lanza en negativos — devuelve `{ valid: false, reason }`.

### Sección D — Tests cubren las propiedades clave

- Cadena de hashes (prev = hash anterior).
- Multi-tenant aislado.
- Tampering del contentHash y de la signature detectados.
- Idempotencia de keygen.

### Sección E — Riesgos detectados (si hay alguno)

Cualquier cosa que se note manualmente al leer el código:

- Race conditions no manejadas explícitamente.
- Edge cases de la conversión Date↔ms.
- Claves PEM con whitespace que rompan la verificación.
- Falta de manejo de rotación de keys (anotada como follow-up del ADR).

---

**Nota para Jorge:** este sub-PR es operativo de punta a punta dentro del
adapter — un caller puede instanciarlo con un cliente Prisma real y un
`NOTARY_MASTER_KEY` y empezar a anclar. Lo único que falta es el módulo
NestJS del sub-PR 4 que lo expone vía HTTP.
