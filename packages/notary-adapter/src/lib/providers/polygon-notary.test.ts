// -----------------------------------------------------------------------------
// Tests del PolygonNotaryAdapter (sub-PR 3).
//
// Estrategia: fakes estructurales — `PolygonSigner` + `PolygonProvider`
// fake que simulan los métodos que el adapter usa. Cero `ethers` runtime,
// cero red, cero keys de prueba.
//
// Lo que cubrimos:
//   - Validaciones de input en `anchor()`.
//   - Golden path: anchor() broadcast + 1 confirmación → status='confirmed'
//     con detalles correctos.
//   - Si `wait()` excede timeout → status='pending' (tx ya broadcast).
//   - Si la tx se revierte on-chain → lanza.
//   - Si el broadcast falla → lanza con mensaje sanitizado (sin URLs
//     internas filtradas).
//   - `getExplorerUrl()` arma URL correcta por red.
//   - `verify()` golden path: tx existe + data matches → valid=true con
//     blockNumber + explorerUrl.
//   - `verify()` detecta contentHash alterado.
//   - `verify()` rechaza tx inexistente.
//   - `verify()` rechaza tx en mempool (blockNumber=null).
//   - `verify()` con inputs malformados.
// -----------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';

import {
  PolygonNotaryAdapter,
  type PolygonNotaryDeps,
  type PolygonOnchainTx,
  type PolygonProvider,
  type PolygonSigner,
  type PolygonTxReceipt,
  type PolygonTxRequest,
  type PolygonTxResponse,
} from './polygon-notary.js';

const VALID_HASH = 'a'.repeat(64);
const SIGNER_ADDRESS = '0xDeadBeef0000000000000000000000000000beef';

// ---------------------------------------------------------------------------
// Fake builders
// ---------------------------------------------------------------------------

/**
 * Construye un PolygonProvider fake con una tabla de txs precargada.
 * `getTransaction(hash)` resuelve contra la tabla.
 */
function makeFakeProvider(txs: PolygonOnchainTx[]): PolygonProvider {
  return {
    async getTransaction(hash: string) {
      return txs.find((t) => t.hash === hash) ?? null;
    },
  };
}

/**
 * Construye un PolygonSigner fake. Cada `sendTransaction()` produce un
 * `txHash` derivado del nonce interno; el `wait()` se controla con la
 * función `waitImpl` provista por el test.
 */
function makeFakeSigner(opts: {
  provider?: PolygonProvider;
  sendImpl?: (tx: PolygonTxRequest) => Promise<PolygonTxResponse>;
}): PolygonSigner {
  const provider = opts.provider ?? makeFakeProvider([]);
  let counter = 0;
  return {
    async getAddress() {
      return SIGNER_ADDRESS;
    },
    sendTransaction:
      opts.sendImpl ??
      (async (tx: PolygonTxRequest) => {
        counter += 1;
        const hash = `0x${counter.toString(16).padStart(64, '0')}`;
        return {
          hash,
          async wait(_confirmations?: number, _timeoutMs?: number) {
            void _confirmations;
            void _timeoutMs;
            void tx;
            const receipt: PolygonTxReceipt = {
              hash,
              blockNumber: 100 + counter,
              status: 1,
            };
            return receipt;
          },
        };
      }),
    provider,
  };
}

function makeDeps(
  overrides: Partial<PolygonNotaryDeps> = {},
): PolygonNotaryDeps {
  const signer = overrides.signer ?? makeFakeSigner({});
  return {
    signer,
    network: overrides.network ?? 'polygon-amoy',
    confirmations: overrides.confirmations,
    waitTimeoutMs: overrides.waitTimeoutMs,
    secrets: overrides.secrets,
  };
}

// ---------------------------------------------------------------------------
// anchor() — validaciones
// ---------------------------------------------------------------------------

describe('PolygonNotaryAdapter.anchor() validaciones', () => {
  it('rechaza contentHash con longitud distinta a 64', async () => {
    const adapter = new PolygonNotaryAdapter(makeDeps());
    await expect(
      adapter.anchor({ contentHash: 'corto', tenantId: 't', documentId: 'd' }),
    ).rejects.toThrow(/64 chars/);
  });

  it('rechaza contentHash no-hex', async () => {
    const adapter = new PolygonNotaryAdapter(makeDeps());
    await expect(
      adapter.anchor({
        contentHash: 'z'.repeat(64),
        tenantId: 't',
        documentId: 'd',
      }),
    ).rejects.toThrow(/hex/);
  });

  it('rechaza tenantId vacío', async () => {
    const adapter = new PolygonNotaryAdapter(makeDeps());
    await expect(
      adapter.anchor({
        contentHash: VALID_HASH,
        tenantId: '',
        documentId: 'd',
      }),
    ).rejects.toThrow(/tenantId/);
  });

  it('rechaza documentId vacío', async () => {
    const adapter = new PolygonNotaryAdapter(makeDeps());
    await expect(
      adapter.anchor({
        contentHash: VALID_HASH,
        tenantId: 't',
        documentId: '',
      }),
    ).rejects.toThrow(/documentId/);
  });
});

// ---------------------------------------------------------------------------
// anchor() — golden path + edge cases
// ---------------------------------------------------------------------------

describe('PolygonNotaryAdapter.anchor() golden path', () => {
  it('broadcast + 1 confirmación → status=confirmed', async () => {
    const adapter = new PolygonNotaryAdapter(makeDeps());
    const result = await adapter.anchor({
      contentHash: VALID_HASH,
      tenantId: 'tenant-utpl',
      documentId: 'doc-1',
    });

    expect(result.provider).toBe('polygon');
    expect(result.status).toBe('confirmed');
    expect(result.anchorId).toMatch(/^0x[0-9a-f]{64}$/);
    expect(result.details).toMatchObject({
      network: 'polygon-amoy',
      txHash: result.anchorId,
      from: SIGNER_ADDRESS,
      anchoredHash: VALID_HASH,
    });
    expect(result.details.blockNumber).toBe(101);
    expect(result.details.explorerUrl).toContain(
      'https://amoy.polygonscan.com/tx/',
    );
  });

  it('manda data con prefix 0x + hex del contentHash al signer', async () => {
    let received: PolygonTxRequest | undefined;
    const signer = makeFakeSigner({
      sendImpl: async (tx) => {
        received = tx;
        return {
          hash: '0x' + '1'.repeat(64),
          async wait() {
            return { hash: '0x' + '1'.repeat(64), blockNumber: 200, status: 1 };
          },
        };
      },
    });
    const adapter = new PolygonNotaryAdapter(makeDeps({ signer }));
    await adapter.anchor({
      contentHash: VALID_HASH,
      tenantId: 't',
      documentId: 'd',
    });
    expect(received).toBeDefined();
    expect(received?.to).toBe(SIGNER_ADDRESS); // self-send
    expect(received?.value).toBe(0n);
    expect(received?.data).toBe('0x' + VALID_HASH); // 0x + hash lowercase
  });

  it('timeout en wait() → devuelve status=pending con txHash', async () => {
    const signer = makeFakeSigner({
      sendImpl: async () => ({
        hash: '0x' + 'a'.repeat(64),
        async wait() {
          // Simula timeout: ethers v6 puede lanzar; tratamos esto como pending.
          throw new Error('timeout waiting for confirmation');
        },
      }),
    });
    const adapter = new PolygonNotaryAdapter(makeDeps({ signer }));
    const result = await adapter.anchor({
      contentHash: VALID_HASH,
      tenantId: 't',
      documentId: 'd',
    });
    expect(result.status).toBe('pending');
    expect(result.anchorId).toBe('0x' + 'a'.repeat(64));
    expect(result.details.blockNumber).toBeNull();
  });

  it('tx revertida on-chain (status=0) → lanza', async () => {
    const signer = makeFakeSigner({
      sendImpl: async () => ({
        hash: '0x' + 'b'.repeat(64),
        async wait() {
          return { hash: '0x' + 'b'.repeat(64), blockNumber: 300, status: 0 };
        },
      }),
    });
    const adapter = new PolygonNotaryAdapter(makeDeps({ signer }));
    await expect(
      adapter.anchor({
        contentHash: VALID_HASH,
        tenantId: 't',
        documentId: 'd',
      }),
    ).rejects.toThrow(/revirtió on-chain/);
  });

  it('broadcast falla → lanza con mensaje sanitizado (sin stack trace)', async () => {
    const longError = 'a'.repeat(500) + 'http://internal-rpc:8545/secret';
    const signer = makeFakeSigner({
      sendImpl: async () => {
        throw new Error(longError);
      },
    });
    const adapter = new PolygonNotaryAdapter(makeDeps({ signer }));
    try {
      await adapter.anchor({
        contentHash: VALID_HASH,
        tenantId: 't',
        documentId: 'd',
      });
      throw new Error('debería haber lanzado');
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toMatch(/broadcast falló/);
      // Mensaje truncado a 200 chars max — la URL interna NO debería
      // aparecer porque está al final del long error.
      expect(msg).not.toContain('internal-rpc');
      expect(msg.length).toBeLessThan(300);
    }
  });

  it('sanitizeError redacta URLs al inicio del mensaje (no solo al final)', async () => {
    // Hallazgo Codex: si la URL aparecía al inicio, el truncate a 200 chars
    // no la cubría. Ahora el regex la redacta sí o sí.
    const signer = makeFakeSigner({
      sendImpl: async () => {
        throw new Error(
          'http://internal-rpc:8545/v1?key=abc123 connection refused',
        );
      },
    });
    const adapter = new PolygonNotaryAdapter(makeDeps({ signer }));
    try {
      await adapter.anchor({
        contentHash: VALID_HASH,
        tenantId: 't',
        documentId: 'd',
      });
      throw new Error('debería haber lanzado');
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toContain('[REDACTED]');
      expect(msg).not.toContain('internal-rpc');
      expect(msg).not.toContain('abc123');
    }
  });

  it('sanitizeError redacta wallet private keys (0x + 64 hex)', async () => {
    const signer = makeFakeSigner({
      sendImpl: async () => {
        throw new Error(
          'failed signing with 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        );
      },
    });
    const adapter = new PolygonNotaryAdapter(makeDeps({ signer }));
    try {
      await adapter.anchor({
        contentHash: VALID_HASH,
        tenantId: 't',
        documentId: 'd',
      });
      throw new Error('debería haber lanzado');
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toContain('[REDACTED]');
      expect(msg).not.toContain('1234567890abcdef');
    }
  });

  it('sanitizeError redacta los secrets explícitos del config (RPC URL, etc)', async () => {
    const RPC = 'https://rpc.example.com/secret-token-xyz';
    const signer = makeFakeSigner({
      sendImpl: async () => {
        // El error viene como string libre — la URL exacta aparece tal cual.
        throw new Error(`got 500 from upstream while calling foo`);
      },
    });
    const adapter = new PolygonNotaryAdapter(
      makeDeps({ signer, secrets: [RPC] }),
    );
    try {
      await adapter.anchor({
        contentHash: VALID_HASH,
        tenantId: 't',
        documentId: 'd',
      });
      throw new Error('debería haber lanzado');
    } catch (err) {
      const msg = (err as Error).message;
      // Caso degenerado: secrets vacíos (env not set). Acá no aparece, pero
      // el otro test cubre que cuando aparece, se redacta.
      expect(msg).toContain('500 from upstream');
      expect(msg).not.toContain(RPC);
    }

    // Caso real: la URL aparece literalmente en el mensaje.
    const signer2 = makeFakeSigner({
      sendImpl: async () => {
        throw new Error(`request to ${RPC} failed`);
      },
    });
    const adapter2 = new PolygonNotaryAdapter(
      makeDeps({ signer: signer2, secrets: [RPC] }),
    );
    try {
      await adapter2.anchor({
        contentHash: VALID_HASH,
        tenantId: 't',
        documentId: 'd',
      });
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).not.toContain(RPC);
      expect(msg).not.toContain('secret-token-xyz');
      expect(msg).toContain('[REDACTED]');
    }
  });

  it('sanitizeError ignora secrets vacíos (sin redact entero del mensaje)', async () => {
    // Defensa contra env vars no seteadas: deps.secrets puede traer ''.
    const signer = makeFakeSigner({
      sendImpl: async () => {
        throw new Error('connection refused');
      },
    });
    const adapter = new PolygonNotaryAdapter(
      makeDeps({ signer, secrets: ['', ''] }),
    );
    try {
      await adapter.anchor({
        contentHash: VALID_HASH,
        tenantId: 't',
        documentId: 'd',
      });
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toContain('connection refused');
      expect(msg).not.toContain('[REDACTED]');
    }
  });
});

// ---------------------------------------------------------------------------
// getExplorerUrl
// ---------------------------------------------------------------------------

describe('PolygonNotaryAdapter.getExplorerUrl', () => {
  it('amoy', () => {
    const adapter = new PolygonNotaryAdapter(
      makeDeps({ network: 'polygon-amoy' }),
    );
    expect(adapter.getExplorerUrl('0xabc')).toBe(
      'https://amoy.polygonscan.com/tx/0xabc',
    );
  });

  it('mainnet', () => {
    const adapter = new PolygonNotaryAdapter(
      makeDeps({ network: 'polygon-mainnet' }),
    );
    expect(adapter.getExplorerUrl('0xabc')).toBe(
      'https://polygonscan.com/tx/0xabc',
    );
  });

  it('red desconocida → string vacío (UI no muestra link)', () => {
    const adapter = new PolygonNotaryAdapter(
      makeDeps({ network: 'red-experimental' }),
    );
    expect(adapter.getExplorerUrl('0xabc')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// verify()
// ---------------------------------------------------------------------------

describe('PolygonNotaryAdapter.verify()', () => {
  const TX_HASH = '0x' + 'c'.repeat(64);

  function makeAdapterWithTxs(txs: PolygonOnchainTx[]): PolygonNotaryAdapter {
    const provider = makeFakeProvider(txs);
    const signer = makeFakeSigner({ provider });
    return new PolygonNotaryAdapter(makeDeps({ signer }));
  }

  it('tx existe + data matches → valid=true con explorerUrl', async () => {
    const adapter = makeAdapterWithTxs([
      {
        hash: TX_HASH,
        data: '0x' + VALID_HASH,
        blockNumber: 500,
      },
    ]);
    const v = await adapter.verify(TX_HASH, VALID_HASH);
    expect(v.valid).toBe(true);
    expect(v.provider).toBe('polygon');
    expect(v.details).toMatchObject({
      network: 'polygon-amoy',
      txHash: TX_HASH,
      blockNumber: 500,
    });
    expect(v.details.explorerUrl).toContain('amoy.polygonscan.com');
  });

  it('verify ignora case del data (RPC puede devolver upper o lower hex)', async () => {
    const upperData = '0x' + VALID_HASH.toUpperCase();
    const adapter = makeAdapterWithTxs([
      { hash: TX_HASH, data: upperData, blockNumber: 500 },
    ]);
    const v = await adapter.verify(TX_HASH, VALID_HASH);
    expect(v.valid).toBe(true);
  });

  it('contentHash alterado → valid=false con razón clara', async () => {
    const adapter = makeAdapterWithTxs([
      { hash: TX_HASH, data: '0x' + VALID_HASH, blockNumber: 500 },
    ]);
    const altered = 'b'.repeat(64);
    const v = await adapter.verify(TX_HASH, altered);
    expect(v.valid).toBe(false);
    expect(v.reason).toMatch(/no matchea/);
  });

  it('tx pending (blockNumber=null) → valid=false (no confirmada todavía)', async () => {
    const adapter = makeAdapterWithTxs([
      { hash: TX_HASH, data: '0x' + VALID_HASH, blockNumber: null },
    ]);
    const v = await adapter.verify(TX_HASH, VALID_HASH);
    expect(v.valid).toBe(false);
    expect(v.reason).toMatch(/pending/);
  });

  it('tx no encontrada → valid=false', async () => {
    const adapter = makeAdapterWithTxs([]);
    const v = await adapter.verify('0xdeadbeef', VALID_HASH);
    expect(v.valid).toBe(false);
    expect(v.reason).toMatch(/no encontrada/);
  });

  it('anchorId vacío → valid=false', async () => {
    const adapter = makeAdapterWithTxs([]);
    const v = await adapter.verify('', VALID_HASH);
    expect(v.valid).toBe(false);
    expect(v.reason).toMatch(/vacío/);
  });

  it('contentHash mal formado → valid=false', async () => {
    const adapter = makeAdapterWithTxs([]);
    const v = await adapter.verify(TX_HASH, 'corto');
    expect(v.valid).toBe(false);
    expect(v.reason).toMatch(/contentHash inválido/);
  });

  it('verify tolera prefijo 0x opcional en el contentHash recibido', async () => {
    const adapter = makeAdapterWithTxs([
      {
        hash: TX_HASH,
        data: '0x' + VALID_HASH,
        blockNumber: 100,
      },
    ]);
    const withPrefix = '0x' + VALID_HASH;
    const v = await adapter.verify(TX_HASH, withPrefix);
    expect(v.valid).toBe(true);
  });

  it('verify rechaza contentHash con longitud 64 pero no-hex', async () => {
    const adapter = makeAdapterWithTxs([]);
    const v = await adapter.verify(TX_HASH, 'g'.repeat(64));
    expect(v.valid).toBe(false);
    expect(v.reason).toMatch(/contentHash inválido/);
  });

  it('provider.getTransaction lanza → valid=false con razón sanitizada', async () => {
    const broken: PolygonProvider = {
      async getTransaction() {
        throw new Error('RPC down at http://internal-rpc:8545');
      },
    };
    const signer = makeFakeSigner({ provider: broken });
    const adapter = new PolygonNotaryAdapter(makeDeps({ signer }));
    const v = await adapter.verify(TX_HASH, VALID_HASH);
    expect(v.valid).toBe(false);
    expect(v.reason).toMatch(/fallo al consultar/);
  });
});
