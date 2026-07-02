// -----------------------------------------------------------------------------
// Tests de BiService.
//
// Cubrimos el camino crítico para demos con Mac/Ubuntu local: si SQLCoder
// pre-genera un query, el backend lo ejecuta antes del primer turno del LLM
// general y le pasa las filas como tool_result. Así el modelo conversacional
// solo decide chart + narrativa.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockStreamWithTools, mockQueryRawUnsafe } = vi.hoisted(() => ({
  mockStreamWithTools: vi.fn(),
  mockQueryRawUnsafe: vi.fn(),
}));

vi.mock('@org/llm-adapter', () => ({
  chat: { streamWithTools: mockStreamWithTools },
}));

vi.mock('@org/db', () => ({
  prisma: {
    $queryRawUnsafe: mockQueryRawUnsafe,
  },
}));

import { SqlGenerationService } from '../sql-generation/sql-generation.service.js';

import { BiService } from './bi.service.js';
import type { BiChatEvent } from './dto/bi.dto.js';

async function* asStream<T>(items: T[]): AsyncIterable<T> {
  for (const i of items) yield i;
}

async function collect(
  iter: AsyncIterable<BiChatEvent>,
): Promise<BiChatEvent[]> {
  const out: BiChatEvent[] = [];
  for await (const ev of iter) out.push(ev);
  return out;
}

describe('BiService.chat()', () => {
  let sqlGen: SqlGenerationService;
  let service: BiService;

  beforeEach(() => {
    mockStreamWithTools.mockReset();
    mockQueryRawUnsafe.mockReset();
    sqlGen = {
      generateIfAvailable: vi.fn().mockResolvedValue(null),
      formatHintForLlm: vi.fn(),
    } as unknown as SqlGenerationService;
    service = new BiService(sqlGen);
  });

  it('pre-ejecuta SQLCoder y entrega filas al LLM antes de pedir chart/narrativa', async () => {
    vi.mocked(sqlGen.generateIfAvailable).mockResolvedValueOnce(
      'SELECT "productoTipo", SUM("montoUsd") AS cartera_usd FROM "BiPrestamo" GROUP BY "productoTipo" ORDER BY cartera_usd DESC LIMIT 5',
    );
    mockQueryRawUnsafe.mockResolvedValueOnce([
      { productoTipo: 'consumo', cartera_usd: 125000n },
      { productoTipo: 'microempresa', cartera_usd: 98000n },
    ]);

    const callSnapshots: { messages: unknown[] }[] = [];
    mockStreamWithTools.mockImplementation((messages: unknown[]) => {
      callSnapshots.push({ messages: JSON.parse(JSON.stringify(messages)) });
      if (callSnapshots.length === 1) {
        return asStream([
          {
            type: 'tool_use_complete',
            id: 'chart_1',
            name: 'render_chart',
            input: {
              chartType: 'bar',
              title: 'Cartera por producto',
              xAxis: { key: 'productoTipo', label: 'Producto' },
              yAxis: [{ key: 'cartera_usd', label: 'Cartera USD' }],
            },
          },
          { type: 'turn_end', stopReason: 'tool_use' },
        ]);
      }
      return asStream([
        {
          type: 'text_delta',
          text: 'La mayor cartera está en consumo.',
        },
        { type: 'turn_end', stopReason: 'end_turn' },
      ]);
    });

    const events = await collect(
      service.chat(
        'tenant-demo',
        {
          message: 'Muéstrame la cartera por producto',
        },
        'private-mac',
      ),
    );

    expect(events[0]).toMatchObject({
      type: 'sql',
      tablesUsed: ['BiPrestamo'],
    });
    expect(events[1]).toEqual({
      type: 'rows',
      columns: ['productoTipo', 'cartera_usd'],
      rows: [
        ['consumo', '125000'],
        ['microempresa', '98000'],
      ],
      rowCount: 2,
    });
    expect(events).toContainEqual({
      type: 'chart',
      spec: {
        chartType: 'bar',
        title: 'Cartera por producto',
        xAxis: { key: 'productoTipo', label: 'Producto' },
        yAxis: [{ key: 'cartera_usd', label: 'Cartera USD' }],
        description: undefined,
      },
    });
    expect(events).toContainEqual({
      type: 'token',
      text: 'La mayor cartera está en consumo.',
    });
    expect(events.at(-1)).toMatchObject({ type: 'done', turns: 2 });

    expect(mockQueryRawUnsafe).toHaveBeenCalledOnce();
    const sanitizedSql = mockQueryRawUnsafe.mock.calls[0][0] as string;
    expect(sanitizedSql).toContain('"BiPrestamo"."tenantId" = \'tenant-demo\'');
    expect(sanitizedSql).toContain('LIMIT 5');

    const firstMessages = callSnapshots[0].messages as Array<{
      role: string;
      content: unknown;
    }>;
    expect(firstMessages).toHaveLength(4);
    expect(firstMessages[0].content).toEqual(
      expect.stringContaining('Resultado SQL pre-ejecutado'),
    );
    expect(firstMessages[2]).toMatchObject({
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'sqlcoder_pre_run',
          name: 'run_sql',
        },
      ],
    });
    expect(firstMessages[3]).toMatchObject({
      role: 'user',
      content: [
        {
          type: 'tool_result',
          toolUseId: 'sqlcoder_pre_run',
          isError: false,
        },
      ],
    });
  });
});
