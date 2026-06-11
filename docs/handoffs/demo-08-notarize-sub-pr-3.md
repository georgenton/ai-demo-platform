# Handoff Codex — Demo 08 sub-PR 3 (Notarización · Polygon anchor)

> **Cómo usar este documento.** Léelo y verifica las secciones
> reproducibles. Devuelve hallazgos en el formato pedido al final.

## Qué cambia este sub-PR

Tercer sub-PR del tren ADR-0019. **Implementación real del
`PolygonNotaryAdapter`** — anchor on-chain en Polygon (testnet Amoy
durante el demo, mainnet en producción real).

### Cambio importante en el ADR-0019

La versión inicial del ADR mencionaba **Polygon Mumbai**, pero esa
testnet fue **deprecada por Polygon en abril 2024**. La testnet oficial
activa hoy es **Polygon Amoy** (Chain ID 80002, explorer
`amoy.polygonscan.com`). Este sub-PR ajusta el ADR + todo el código a
Amoy. La decisión arquitectónica (tx self-send con `data = hex(hash)`,
mismo flujo testnet↔mainnet) NO cambia.

### Stacked sobre sub-PR 2

Esta rama se basa en `feat/demo-08-notarize-pr-2-local-notary` (PR #101).
Cuando #101 se mergee, GitHub recalcula la base automáticamente.

### Archivos tocados

| Archivo                                                            | Cambio                                                                                                                                                                          |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/adr/0019-demo-08-notarization.md`                            | Mumbai → Amoy en 7 lugares + nota histórica de la deprecación.                                                                                                                  |
| `packages/notary-adapter/src/lib/providers/polygon-notary.ts`      | Reescritura completa del stub. Interfaces estructurales `PolygonSigner`/`PolygonProvider`/etc — package NO depende de ethers en runtime.                                        |
| `packages/notary-adapter/src/lib/providers/polygon-notary.test.ts` | 19 tests con fakes estructurales: validaciones, golden path, timeout, tx revertida, error sanitization, verify golden + casos negativos.                                        |
| `packages/notary-adapter/src/index.ts`                             | Exporta los nuevos tipos estructurales (`PolygonNetwork`, `PolygonSigner`, `PolygonProvider`, `PolygonOnchainTx`, `PolygonTxRequest`, `PolygonTxResponse`, `PolygonTxReceipt`). |
| `packages/notary-adapter/src/lib/notary.test.ts`                   | Quitado el test "Stub PolygonNotaryAdapter lanza no implementado". El test del factory ahora usa un `PolygonSigner` estructural fake.                                           |
| `docs/handoffs/demo-08-notarize-sub-pr-3.md`                       | Este documento.                                                                                                                                                                 |

### Lo que NO toca este sub-PR

- `apps/api` / `apps/web` — sin cambios.
- `package.json` raíz — NO sumamos `ethers` aún. El package se mantiene
  cero-deps de runtime. Cuando el sub-PR 4 conecte el adapter al
  `NotarizationModule`, ahí se suma `ethers` como dep del `apps/api`.
- Endpoints REST — sub-PR 4.
- Frontend `/demo/notarize` — sub-PR 5.

## Por qué interfaces estructurales (no `ethers` en el package)

```
┌─────────────────────────────────────────────────────────────┐
│ Consumer (apps/api en sub-PR 4)                             │
│                                                             │
│   import { Wallet, JsonRpcProvider } from 'ethers';        │
│   import { PolygonNotaryAdapter } from '@org/notary-adapter';│
│                                                             │
│   const provider = new JsonRpcProvider(POLYGON_RPC_URL);   │
│   const signer = new Wallet(POLYGON_WALLET_KEY, provider);  │
│                                                             │
│   const adapter = new PolygonNotaryAdapter({                │
│     signer,                  // ← ethers.Wallet matchea     │
│     network: 'polygon-amoy', //   por estructura            │
│   });                                                       │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ @org/notary-adapter                                         │
│                                                             │
│   interface PolygonSigner {                                 │
│     getAddress(): Promise<string>;                          │
│     sendTransaction(tx): Promise<PolygonTxResponse>;        │
│     readonly provider: PolygonProvider;                     │
│   }                                                         │
│                                                             │
│   // ↑ ethers.Wallet matchea por structural typing.         │
│   // Tests pasan fakes triviales sin red ni keys.           │
└─────────────────────────────────────────────────────────────┘
```

Ventajas:

- El package es portable (cualquier signer estructural funciona).
- Tests no necesitan ethers ni red.
- Migrar a otra librería (viem, web3.js) en el futuro es swap del
  consumer, no del adapter.

## Cómo verificar el sub-PR

### Sección 1 — Compilación + tests

```bash
cd ~/Projects_local/ai-demo-platform
npx tsc -p packages/notary-adapter/tsconfig.lib.json
npm test                # esperado: 498/498 verde (sub-PR 2 tenía 479; +19 nuevos)
npm run lint            # esperado: sin output
```

### Sección 2 — Inspección del PolygonNotaryAdapter

`packages/notary-adapter/src/lib/providers/polygon-notary.ts`:

1. Define `PolygonSigner`, `PolygonProvider`, `PolygonTxRequest`,
   `PolygonTxResponse`, `PolygonTxReceipt`, `PolygonOnchainTx` como
   interfaces estructurales (sin import de `ethers`).
2. `anchor()` construye tx self-send: `to = await signer.getAddress()`,
   `value = 0n`, `data = '0x' + contentHash.toLowerCase()`.
3. `anchor()` espera `confirmations` (default 1) con timeout
   (default 30s). Si timeout → status='pending'. Si tx revertida
   (`receipt.status === 0`) → lanza.
4. `anchor()` sanitiza errores del broadcast: truncado a 200 chars max,
   sin exponer URLs internas.
5. `verify()` decodifica `tx.data` (strip `0x`) y compara con
   `contentHash` case-insensitive.
6. `verify()` rechaza si tx existe pero `blockNumber === null` (mempool).
7. `getExplorerUrl()`: `amoy.polygonscan.com` para amoy,
   `polygonscan.com` para mainnet, string vacío para redes desconocidas.

### Sección 3 — Cobertura de tests del Polygon

`polygon-notary.test.ts` (19 tests):

- **anchor() validaciones (4)**: contentHash longitud, hex válido,
  tenantId vacío, documentId vacío.
- **anchor() golden path (5)**: shape correcto + status=confirmed,
  data con prefix 0x al signer, timeout → status=pending, tx revertida
  → lanza, broadcast falla → mensaje sanitizado (URL interna no aparece).
- **getExplorerUrl (3)**: amoy, mainnet, red desconocida.
- **verify() (7)**: golden path, case-insensitive del data, contentHash
  alterado, tx pending (mempool), tx no encontrada, anchorId vacío,
  contentHash mal formado, provider.getTransaction lanza.

### Sección 4 — Setup esperado en sub-PR 4 (para contexto)

Cuando el `NotarizationService` use este adapter:

```ts
import { Wallet, JsonRpcProvider } from 'ethers';
import { notaryFor } from '@org/notary-adapter';

const provider = new JsonRpcProvider(process.env.POLYGON_RPC_URL);
const signer = new Wallet(process.env.POLYGON_WALLET_KEY!, provider);

const polygonAdapter = notaryFor('polygon', {
  polygon: { signer, network: 'polygon-amoy' },
});

const result = await polygonAdapter.anchor({
  contentHash: pdfSha256Hex,
  tenantId: 'utpl',
  documentId: doc.id,
});

// result.anchorId = txHash
// result.details.explorerUrl = "https://amoy.polygonscan.com/tx/0x..."
// result.status = 'confirmed' | 'pending'
```

Env vars que el sub-PR 4 va a agregar a Railway:

```
POLYGON_RPC_URL=https://rpc-amoy.polygon.technology
POLYGON_WALLET_KEY=<private-key-de-wallet-de-demo>
POLYGON_NETWORK=polygon-amoy
```

La wallet del demo necesita MATIC/POL de testnet (faucet:
https://faucet.polygon.technology). Cada anchor cuesta ~24400 gas.

## Lo que necesito que Codex me reporte

Devuelve un único bloque markdown con estas secciones literales:

### Sección A — Compilación local

- `tsc notary-adapter` salida.
- `npm test` salida (resumen, # tests).
- `npm run lint` salida.

### Sección B — ADR-0019 actualizado

- Mumbai → Amoy en las secciones "Decisión", "Por qué Polygon... testnet",
  "Consecuencias positivas", "Negativas", "Plan de implementación".
- Aparece la nota histórica de la deprecación.
- El link a `polygonscan.com` es `amoy.polygonscan.com`.

### Sección C — PolygonNotaryAdapter

- NO importa nada de `ethers` (verifica con `grep -E "from 'ethers'"`).
- Define interfaces estructurales `PolygonSigner`, `PolygonProvider`,
  `PolygonTxRequest`, `PolygonTxResponse`, `PolygonTxReceipt`,
  `PolygonOnchainTx`.
- `anchor()` espera confirmaciones con timeout, maneja revertida vs
  pending vs success.
- `verify()` decodifica `tx.data` strippeando `0x`, compara
  case-insensitive.
- `sanitizeError()` trunca a 200 chars.

### Sección D — Tests cubren las propiedades clave

- Self-send con data=`0x` + hash.
- Timeout → pending, revertida → throw.
- Mensajes de error sanitizados (URL interna no leak).
- Verify case-insensitive.
- Mempool (blockNumber=null) → invalid.

### Sección E — Riesgos detectados (si hay alguno)

Cualquier cosa que se note manualmente:

- Falta de reintento ante nonce conflict (sub-PR 4 puede manejarlo).
- Wait con confirmations=1 puede dar finalidad débil en mainnet.
- `tx.data` puede traer leading whitespace en algunos RPCs (?).
- Manejo de wallet sin saldo: solo lanza con mensaje genérico —
  ¿queremos detectar específicamente "insufficient funds"?

---

**Nota para Jorge:** este sub-PR es operativo de punta a punta dentro del
adapter — el sub-PR 4 puede crear una `ethers.Wallet` real, pasársela, y
ya tiene anchors on-chain. Cero código nuevo del adapter para producción.
