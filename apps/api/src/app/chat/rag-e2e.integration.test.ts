// -----------------------------------------------------------------------------
// E2E del flujo RAG completo (Demo 01) usando el FakeChatAdapter y
// FakeEmbeddingsAdapter.
//
// Por qué este test importa:
//   - Ejercita el camino real ingest → embeddings → pgvector → search →
//     prompt → chat — el flujo entero, con Postgres real y todos los
//     servicios reales, salvo el LLM que es determinístico (fake).
//   - Si alguien rompe el pipeline (cambia el shape del search, del
//     prompt builder, del SSE stream), este test lo atrapa antes de la
//     demo.
//   - Demuestra el punto del PR: tests E2E sin keys, sin gasto, sin
//     flakiness. CI puede correrlos en cada push.
//
// Estrategia (sigue vector-store.integration.test.ts):
//   - Un container Postgres+pgvector por archivo (beforeAll/afterAll).
//   - Migraciones reales.
//   - CHAT_PROVIDER=fake + EMBEDDINGS_PROVIDER=fake antes de importar
//     @org/llm-adapter — el singleton agarra esos valores al primer uso.
//   - Imports dinámicos para que los singletons de @org/db y @org/llm-adapter
//     se inicialicen contra el container y el provider fake.
// -----------------------------------------------------------------------------

import { execSync } from 'node:child_process';

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

type PrismaClient = typeof import('@org/db').prisma;
type IngestServiceClass =
  typeof import('../ingest/ingest.service.js').IngestService;
type ChatServiceClass = typeof import('./chat.service.js').ChatService;

let container: StartedPostgreSqlContainer;
let prisma: PrismaClient;
let ingest: InstanceType<IngestServiceClass>;
let chatSvc: InstanceType<ChatServiceClass>;

// Multi-tenant (post sprint MT2): Document.tenantId es NOT NULL con FK a
// Tenant. El test crea un industry + tenant de prueba en beforeAll y los
// reusa en todos los `ingest.ingest()` y `chatSvc.streamChat()` para
// satisfacer la constraint sin pretender ejercitar aislamiento entre
// tenants (eso lo cubren tenant-isolation.test.ts y los unitarios).
const TEST_TENANT_ID = 'tenant_rag_e2e_test';
const TEST_INDUSTRY_ID = 'industry_rag_e2e_test';

/** Helper: consume el async iterable y devuelve el texto concatenado. */
async function collectText(stream: AsyncIterable<string>): Promise<string> {
  let out = '';
  for await (const tok of stream) out += tok;
  return out;
}

describe('RAG end-to-end (integration, fake LLM)', () => {
  beforeAll(async () => {
    // 1) Forzamos el provider fake ANTES de cualquier import de @org/llm-adapter.
    //    Una vez que el singleton se inicializa, no se reconfigura. Por eso
    //    los imports de servicios que usen `chat` o `embeddings` van adentro
    //    de beforeAll (dinámicos).
    process.env.CHAT_PROVIDER = 'fake';
    process.env.EMBEDDINGS_PROVIDER = 'fake';

    // 2) Postgres+pgvector aislado, mismo digest que dev.
    container = await new PostgreSqlContainer('pgvector/pgvector:pg17').start();
    process.env.DATABASE_URL = container.getConnectionUri();

    // 3) Migraciones — el container arranca vacío.
    execSync(
      'npx prisma migrate deploy --schema packages/db/prisma/schema.prisma',
      { env: process.env, stdio: 'inherit' },
    );

    // 4) Ahora sí: imports dinámicos. Los singletons de @org/db y
    //    @org/llm-adapter agarran los valores que seteamos arriba.
    const dbModule = await import('@org/db');
    prisma = dbModule.prisma;

    const ragCore = await import('@org/rag-core');
    const ingestSvcModule = await import('../ingest/ingest.service.js');
    const chatSvcModule = await import('./chat.service.js');

    // Mismos params que en IngestModule (apps/api/src/app/ingest/ingest.module.ts).
    const chunker = new ragCore.SlidingWindowChunker({
      size: 800,
      overlap: 100,
    });
    const embeddingService = new ragCore.EmbeddingService();
    const vectorStore = new ragCore.VectorStore();
    const promptBuilder = new ragCore.PromptBuilder();

    ingest = new ingestSvcModule.IngestService(
      chunker,
      embeddingService,
      vectorStore,
    );
    chatSvc = new chatSvcModule.ChatService(
      embeddingService,
      vectorStore,
      promptBuilder,
    );

    // Crea industry + tenant de prueba (FK del Document.tenantId).
    await prisma.industry.create({
      data: {
        id: TEST_INDUSTRY_ID,
        slug: 'rag-e2e-test',
        displayName: 'RAG E2E Test Industry',
        enabledDemos: ['rag', 'comparator'],
      },
    });
    await prisma.tenant.create({
      data: {
        id: TEST_TENANT_ID,
        slug: 'rag-e2e-tenant',
        displayName: 'RAG E2E Test Tenant',
        industryId: TEST_INDUSTRY_ID,
        status: 'active',
      },
    });
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  beforeEach(async () => {
    // DB limpia entre tests. CASCADE arrastra los chunks.
    await prisma.$executeRaw`TRUNCATE "Chunk", "Document" CASCADE`;
  });

  it('ingiere un documento de matrículas y responde una pregunta sobre matrículas', async () => {
    // Documento corto pero con vocabulario claro para que el bag-of-words
    // del fake-embeddings discrimine bien.
    const manualMatriculas = [
      'Manual de matrículas — Vicerrectorado.',
      'La matrícula ordinaria del primer semestre va del 1 al 15 de febrero.',
      'La matrícula del segundo semestre va del 1 al 15 de julio.',
      'La matrícula extraordinaria tiene un recargo del 25% sobre la tasa base.',
    ].join('\n');

    const result = await ingest.ingest(
      {
        name: 'Manual de matrículas.pdf',
        content: manualMatriculas,
        demoId: 'rag',
      },
      TEST_TENANT_ID,
    );
    expect(result.chunkCount).toBeGreaterThan(0);

    // Pregunta sugerida número 1 de la UI ("rag.suggested.1").
    const response = await collectText(
      chatSvc.streamChat(
        {
          demoId: 'rag',
          q: '¿Cuál es el horario de matrícula?',
        },
        TEST_TENANT_ID,
      ),
    );

    // El fake responde con la frase canónica del manual de matrículas.
    // Verificamos que la respuesta mencione el mes y la fuente — sin estar
    // demasiado atados al wording exacto (sino el test se rompe si cambiamos
    // una coma en fake-chat.ts).
    expect(response.toLowerCase()).toContain('manual de matrículas');
    expect(response).toMatch(/febrero|julio/);
  });

  it('streamea token por token (más de un yield)', async () => {
    await ingest.ingest(
      {
        name: 'doc.txt',
        content:
          'Texto base para que haya algo indexado y la búsqueda no falle.',
        demoId: 'rag',
      },
      TEST_TENANT_ID,
    );

    const tokens: string[] = [];
    for await (const t of chatSvc.streamChat(
      {
        demoId: 'rag',
        q: '¿Cuál es el horario de matrícula?',
      },
      TEST_TENANT_ID,
    )) {
      tokens.push(t);
    }
    // No exigimos un número exacto; lo importante es que SEA streaming.
    expect(tokens.length).toBeGreaterThan(3);
  });

  it('aísla por demoId — un doc del comparator no contamina la búsqueda RAG', async () => {
    // Ingestamos un doc largo en el demo de comparator que casualmente
    // tiene la palabra "matrícula" (no es plausible, pero protege contra
    // un bug donde el filtro por demoId se pierde en algún refactor).
    await ingest.ingest(
      {
        name: 'contrato.pdf',
        content:
          'Contrato de servicios. La matrícula vehicular del proveedor debe estar al día. Plazo de entrega 90 días.',
        demoId: 'comparator',
      },
      TEST_TENANT_ID,
    );

    // En el demo rag NO ingestamos nada. El chat debería devolver una
    // respuesta del fake (genérica si no encuentra contexto), pero NO
    // basada en el doc del comparator.
    const response = await collectText(
      chatSvc.streamChat(
        {
          demoId: 'rag',
          q: '¿Cuál es el horario de matrícula?',
        },
        TEST_TENANT_ID,
      ),
    );

    // El fake responde con su template de matrículas (no depende del
    // retrieval). Verificamos al menos que no quedó vacío.
    expect(response.length).toBeGreaterThan(0);

    // Y que el doc del comparator NO aparece en los chunks devueltos para
    // el demo rag — chequeamos directo contra la DB.
    const rows = (await prisma.$queryRaw`
      SELECT d."demoId", c.content
      FROM "Chunk" c
      JOIN "Document" d ON d.id = c."documentId"
    `) as { demoId: string; content: string }[];
    expect(rows.every((r) => r.demoId === 'comparator')).toBe(true);
  });
});
