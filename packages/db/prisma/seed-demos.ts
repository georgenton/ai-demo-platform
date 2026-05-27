// -----------------------------------------------------------------------------
// Seed de documentos sample para los demos RAG y Comparator.
//
// Por qué este script existe:
//   En una demo en vivo, empezar con la app vacía y tener que arrastrar
//   archivos genera nervios y depende de que el WiFi del cliente funcione.
//   Este seed pre-carga 3 documentos para RAG y 3 para Comparator antes
//   de la presentación, así Jorge abre la app y ya tiene contenido listo.
//
// Cómo funciona:
//   1) Lee los .txt de packages/db/prisma/seed-demos-data/.
//   2) Para cada uno, POSTea a `/api/v1/ingest` del backend en marcha.
//      El backend hace chunking + embeddings + persistencia — mismo
//      pipeline que un usuario subiendo un documento.
//
// Requisitos:
//   - El backend (nx serve api) debe estar corriendo en localhost:3000.
//   - `.env` con CHAT_API_KEY y EMBEDDINGS_API_KEY válidas (sin esto el
//     embedding del ingest falla; el seed reporta el error y continúa).
//
// Idempotencia:
//   Antes de postear, consulta `GET /documents?demoId=...` y verifica si
//   un doc con el mismo `name` ya existe. Si existe, lo skipea con un
//   log claro. Correr dos veces no duplica.
//
// Cómo correr:
//   # Terminal 1
//   npx nx serve api
//   # Terminal 2
//   npm run db:seed:demos
// -----------------------------------------------------------------------------

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

interface SampleDoc {
  name: string;
  demoId: 'rag' | 'comparator';
  content: string;
}

interface IngestResponse {
  documentId: string;
  chunkCount: number;
}

interface ListDocumentsResponse {
  items: Array<{ id: string; name: string; demoId: string }>;
  total: number;
}

// El script se ejecuta vía `tsx` (ESM). Resolvemos paths relativos al
// archivo, no al cwd, para que funcione desde cualquier directorio.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, 'seed-demos-data');

const API_BASE = process.env.SEED_API_BASE ?? 'http://localhost:3000/api/v1';
const HEALTH_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Cargar samples del filesystem
// ---------------------------------------------------------------------------

/**
 * Mapeo de prefix de archivo → metadata del documento. Los archivos siguen
 * la convención `<prefix>-<slug>.txt`.
 */
const SAMPLE_NAMES: Record<
  string,
  { name: string; demoId: 'rag' | 'comparator' }
> = {
  'rag-01-reglamento-academico.txt': {
    name: 'Reglamento académico 2025.pdf',
    demoId: 'rag',
  },
  'rag-02-manual-matriculas.txt': {
    name: 'Manual de matrículas — Vicerrectorado.pdf',
    demoId: 'rag',
  },
  'rag-03-propiedad-intelectual.txt': {
    name: 'Política de propiedad intelectual.pdf',
    demoId: 'rag',
  },
  'cmp-01-contrato-A.txt': {
    name: 'Contrato proveedor A — Edificio Aulario.pdf',
    demoId: 'comparator',
  },
  'cmp-02-contrato-B.txt': {
    name: 'Contrato proveedor B — Edificio Aulario.pdf',
    demoId: 'comparator',
  },
  'cmp-03-contrato-C.txt': {
    name: 'Contrato proveedor C — Mantenimiento.pdf',
    demoId: 'comparator',
  },
};

function loadSamples(): SampleDoc[] {
  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith('.txt'));
  const samples: SampleDoc[] = [];
  for (const file of files) {
    const meta = SAMPLE_NAMES[file];
    if (!meta) {
      console.warn(`⚠️  Skipping ${file} — no metadata registered`);
      continue;
    }
    const content = readFileSync(join(DATA_DIR, file), 'utf8');
    samples.push({ name: meta.name, demoId: meta.demoId, content });
  }
  // Orden estable: rag primero por nombre, después comparator por nombre.
  return samples.sort((a, b) => {
    if (a.demoId !== b.demoId) return a.demoId === 'rag' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

// ---------------------------------------------------------------------------
// Health check del backend
// ---------------------------------------------------------------------------

async function waitForBackend(): Promise<void> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  let lastError: string = '';
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (res.ok) return;
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    await sleep(1000);
  }
  throw new Error(
    `Backend en ${API_BASE} no respondió en ${HEALTH_TIMEOUT_MS / 1000}s.\n` +
      `Último error: ${lastError}\n` +
      `Asegurate de haber corrido \`npx nx serve api\` en otra terminal antes.`,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Idempotencia: ¿ya existe el doc?
// ---------------------------------------------------------------------------

async function existingNames(
  demoId: 'rag' | 'comparator',
): Promise<Set<string>> {
  const res = await fetch(`${API_BASE}/documents?demoId=${demoId}&limit=100`);
  if (!res.ok) {
    throw new Error(
      `Falló GET /documents?demoId=${demoId}: HTTP ${res.status}`,
    );
  }
  const data = (await res.json()) as ListDocumentsResponse;
  return new Set(data.items.map((d) => d.name));
}

// ---------------------------------------------------------------------------
// Ingest de un doc
// ---------------------------------------------------------------------------

async function ingest(doc: SampleDoc): Promise<IngestResponse> {
  const res = await fetch(`${API_BASE}/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(doc),
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      detail = res.statusText;
    }
    throw new Error(`HTTP ${res.status}: ${detail}`);
  }
  return (await res.json()) as IngestResponse;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('🌱 Sembrando documentos sample para los demos…\n');
  console.log(`📡 Verificando que el backend esté arriba (${API_BASE})…`);
  await waitForBackend();
  console.log('   ✓ Backend respondió.\n');

  const samples = loadSamples();
  console.log(`📚 ${samples.length} documentos cargados del filesystem.\n`);

  // Cache de docs existentes por demoId para evitar duplicados.
  const existingByDemo = new Map<string, Set<string>>();
  for (const demoId of ['rag', 'comparator'] as const) {
    existingByDemo.set(demoId, await existingNames(demoId));
  }

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of samples) {
    const existing = existingByDemo.get(doc.demoId);
    if (existing?.has(doc.name)) {
      console.log(`⏭️  [${doc.demoId}] ${doc.name} — ya existe, skip.`);
      skipped++;
      continue;
    }
    try {
      const result = await ingest(doc);
      console.log(
        `✓  [${doc.demoId}] ${doc.name} → ${result.chunkCount} chunks`,
      );
      created++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`✗  [${doc.demoId}] ${doc.name} — ${message}`);
      failed++;
    }
  }

  console.log('');
  console.log(
    `🎉 Listo. ${created} indexados, ${skipped} skipeados (ya existían), ${failed} fallaron.`,
  );

  if (failed > 0) {
    console.error('\n⚠️  Hubo errores. Revisá los logs del backend.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\n💥 Falló el seed:', err.message);
  process.exit(1);
});
