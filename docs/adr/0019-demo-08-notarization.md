# ADR-0019 — Demo 08: Notarización cooperativa con IA

- **Estado:** Propuesto
- **Fecha:** 2026-06-09
- **Decisores:** Jorge
- **Relacionados:** [`ADR-0004`](./0004-llm-adapter-pattern.md) (patrón Adapter), [`ADR-0013`](./0013-multi-tenant-saas-architecture.md) (multi-tenant), [`ADR-0018`](./0018-embeddings-on-prem.md) (on-prem)

## Contexto

Una cooperativa ecuatoriana pide un demo que combine tres cosas sobre el
mismo PDF (acta de asamblea, contrato de préstamo entre socios, contrato
de aporte de capital):

1. **Notarización** — dejar prueba inmutable de que ese PDF existió en un
   momento exacto, con quién lo emitió y sin posibilidad de alteración
   posterior.
2. **Análisis estructurado con IA** — extraer plazos, riesgos, términos,
   responsabilidades, cláusulas relevantes según el tipo de documento.
3. **Verificabilidad** — alguien externo (auditor, SEPS, contraparte
   legal) puede comprobar más tarde que el PDF en sus manos es el
   original notarizado.

El contexto local (cooperativas Ecuador, regulación SEPS, demos
exploratorios) sugiere que **no hay un único approach correcto**. El
discurso comercial de la plataforma es "todo on-prem en tu hardware
Nutanix" (ver [`ADR-0018`](./0018-embeddings-on-prem.md)), pero la
verificabilidad legal externa también pesa.

## Decisión

**Construir un sistema de notarización dual con adapter pattern**,
análogo al `LLMAdapter` que ya usamos:

- Una interfaz `NotaryAdapter` con métodos `anchor(documentHash, metadata)`
  y `verify(anchorId)`.
- Dos implementaciones concretas en este sprint:
  - **`LocalNotaryAdapter` ("Lite")** — un mini-ledger firmado dentro de
    Postgres. Append-only, con cadena de hashes encadenados con el
    anterior, firmado con clave RSA del tenant. Es nuestra "blockchain
    privada honesta de demo": tiene las propiedades de inmutabilidad
    verificables, sin el costo operacional de Hyperledger Fabric.
  - **`PolygonNotaryAdapter`** — sube el hash del documento a Polygon
    Mumbai (testnet, gratis) durante el demo. Para producción real basta
    cambiar la red a Polygon mainnet (~$0.001/anchor). Da
    verificabilidad pública externa: cualquiera con un browser y el tx
    hash puede confirmar que el documento existió en una fecha exacta.
- Un tercer adapter `FakeNotaryAdapter` para CI y tests E2E
  determinísticos.
- El user del demo elige por documento si quiere **solo interno, solo
  público, o ambos** (caso "híbrido" de la conversación con Jorge).

### Tipos de documento soportados (en este sprint)

Tres tipos, cada uno con su propio analyzer LLM (system prompt + tool
schema):

| Tipo                  | Slug                   | Dimensiones que extrae el LLM                                                                           | Riesgos que evalúa                                                                                 |
| --------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Acta de asamblea      | `assembly_minutes`     | Fecha, quórum requerido vs presente, decisiones aprobadas, mayorías por decisión, plazos de impugnación | Quórum insuficiente, decisiones sin mayoría reglamentaria, ausencia de firmas                      |
| Préstamo entre socios | `loan`                 | Monto, plazo, tasa de interés, garantías, cláusula de mora, capacidad de pago referida                  | Tasa por encima de SEPS, garantías insuficientes, ausencia de cláusula de mora                     |
| Aporte de capital     | `capital_contribution` | Monto aportado, derechos del socio (voto, dividendos), plazo de devolución, condiciones de retiro       | Falta de plazo de devolución, derechos del socio mal definidos, conflicto con estatuto cooperativo |

### Por qué Lite y no Hyperledger Fabric

Fabric es "el de verdad" pero requiere 3-5 nodos físicos para que el
consenso entre nodos independientes agregue valor real. En una demo en
un solo Mac, "Fabric con 3 containers" es teatro — todos los nodos son
del mismo operador. Lite cuenta la **misma historia conceptual** (cadena
de hashes inmutable, firmas verificables, append-only) con un 10% del
esfuerzo de implementación. Cuando un cliente firme y pida Fabric real,
basta agregar `FabricNotaryAdapter` como otro provider sin tocar nada
más del sistema.

### Por qué Polygon Mumbai testnet para el demo

- **Gratis**: no necesitamos comprar MATIC con dinero real.
- **Mismo flujo que mainnet**: el código del adapter no cambia entre
  testnet y mainnet — solo la URL del RPC y el chainId. Migrar a
  mainnet en producción es cambiar dos env vars.
- **Tiempo de confirmación bajo (~5s)**: suficiente para mostrar el
  sello "Notarizado ✓" en el demo en vivo.
- **Explorer público**: `mumbai.polygonscan.com/tx/<hash>` permite
  mostrar la verificación en pantalla durante la demo comercial.

### Por qué adapter pattern desde el día 1

Mismo razonamiento que [`ADR-0004`](./0004-llm-adapter-pattern.md): si
mañana el cliente exige Fabric, otra blockchain (Avalanche, Solana), o
una integración con el ECC (Entidad de Certificación de Información
Ecuador), todo el cambio queda en un sub-PR que agrega un nuevo
provider. El controller, el service, el frontend y los analyzers del
LLM no cambian.

## Alternativas consideradas

### Opción A — Solo Polygon (sin notarizer local)

- **Pros:** una sola pieza por mantener; verificabilidad pública directa.
- **Contras:** depende 100% de internet en el demo; choca con el discurso
  on-prem; requiere wallet con saldo en producción. Sin un sello
  on-prem el cliente Nutanix pregunta "¿y si no tengo internet?".

### Opción B — Solo Hyperledger Fabric on-prem

- **Pros:** narrativa "tu propia blockchain" muy alineada al pitch
  Nutanix.
- **Contras:** 12-15 días solo de esa pieza; requiere 3-5 containers
  extra; en un demo single-Mac la "ventaja de consenso entre nodos
  independientes" es ficción.

### Opción C — Híbrido (decidida)

Adapter pattern con dos implementaciones y elección por documento. Da
las tres narrativas (interno-only / público-only / ambos) en un solo
demo, con un solo backend, dos analyzers separados que comparten infra.

### Opción D — Una sola "blockchain de blockchains" (la propuesta original)

La propuesta original del cliente mencionaba "cadena de blockchains".
Anclar el mismo hash en N redes públicas no agrega seguridad práctica
sobre anclar en una bien elegida — solo multiplica el costo y la
complejidad. Si en el futuro alguien lo pide, el adapter pattern permite
sumar más providers sin rediseño.

## Consecuencias

### Positivas

- **Tres narrativas comerciales** desde una sola arquitectura.
- **Cero costo cripto en el demo** (Mumbai testnet).
- **Verificabilidad real** del notarizado local (cadena de firmas
  encadenadas) y del público (explorer público).
- **Escala a Fabric en producción** sin rediseño — solo agregar un
  provider.
- **Compatibilidad con la regulación SEPS**: ambos sellos producen
  evidencia exportable (certificado del local + tx hash del público).

### Negativas / costos

- **Manejo de claves RSA por tenant** — cada cooperativa tiene su propio
  keypair generado al onboarding. Hay que rotarlas, almacenarlas
  cifradas, etc. Para el demo bastan claves generadas en memoria y
  almacenadas en BD (no production-grade, pero suficiente — documentado
  como follow-up).
- **Dependencia del adapter Polygon de `ethers`** — librería nueva en
  el monorepo (~150 KB minified). Justificada por el caso.
- **Mumbai testnet a veces tiene downtime** — un fallback razonable en
  el demo es ofrecer "solo interno" si el adapter Polygon falla
  (manejado en el frontend con un toggle).
- **El user puede pensar que el PDF entero va a blockchain** — la UI
  debe ser explícita: "lo que se sella es la huella digital del
  documento, no el documento en sí".

### Riesgos / cosas a vigilar

- **Si un cliente pide Fabric en producción**, el costo estimado es
  ~12-15 días para agregar el adapter. Hay que comunicarlo en la
  propuesta comercial.
- **Si la regulación SEPS exige integración con el ECC** (firma
  electrónica reconocida), hay que sumar un adapter más. Coste
  desconocido hasta que llegue ese requisito.
- **El hash de un PDF cambia si el PDF se re-genera con metadata
  distinta** (timestamp interno, autor, etc). El demo debe usar el hash
  del binario tal-cual-llegó, no re-procesarlo.

## Plan de implementación

5 sub-PRs:

| Sub-PR   | Qué cambia                                                                                                                             |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1 (este) | ADR + schema Prisma + migración + package `@org/notary-adapter` con types + factory + stubs Local/Polygon + Fake implementado + tests. |
| 2        | `LocalNotaryAdapter` real: generación de keypair RSA por tenant, encadenado, firmado, verificación.                                    |
| 3        | `PolygonNotaryAdapter` real: ethers.js, wallet de demo, anchor a Mumbai, link al explorer, manejo de estados.                          |
| 4        | `NotarizationModule` en `apps/api`: orquesta upload → hash → notary(ies) → análisis LLM con tool-use por tipo.                         |
| 5        | Frontend `/demo/notarize`: selector tipo + upload + modal modo + página resultado con sellos.                                          |

## Cuándo revisar

- Si un cliente real firma y exige Fabric, abrir ADR-0020 con el
  análisis Lite-vs-Fabric a la luz del caso concreto.
- Si Polygon Mumbai deprecara (a veces pasa con testnets), migrar a
  Polygon Amoy o Polygon mainnet — un sub-PR de cambio de RPC.
- Si la SEPS publica una guía formal de notarización con IA, alinear los
  analyzers a esa guía.

## Referencias

- [`ADR-0004`](./0004-llm-adapter-pattern.md) — patrón Adapter del que
  este ADR es la segunda aplicación.
- [`ADR-0018`](./0018-embeddings-on-prem.md) — discurso on-prem que
  este demo respeta vía el `LocalNotaryAdapter`.
- [Polygon Mumbai docs](https://docs.polygon.technology/pos/reference/rpc-endpoints/)
- [ethers.js v6](https://docs.ethers.org/v6/)
- [`docs/handoffs/demo-08-notarize-sub-pr-1.md`](../handoffs/demo-08-notarize-sub-pr-1.md)
  (handoff para Codex).
