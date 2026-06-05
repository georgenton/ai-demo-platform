import type { EmbeddingsAdapter, EmbeddingsConfig } from '../types.js';

type PrivateMacEmbeddingsConfig = EmbeddingsConfig & {
  demoName?: string;
  timeoutMs?: number;
};

function requestId(): string {
  return (
    crypto.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

export class PrivateMacEmbeddingsAdapter implements EmbeddingsAdapter {
  private readonly baseUrl: string;
  private readonly demoName: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: PrivateMacEmbeddingsConfig) {
    if (!config.baseUrl) {
      throw new Error(
        'PRIVATE_LLM_BASE_URL/EMBEDDINGS_BASE_URL is required for private-mac embeddings.',
      );
    }
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.demoName =
      config.demoName ?? process.env.PRIVATE_LLM_DEMO_NAME ?? 'demo-bank';
    this.timeoutMs =
      config.timeoutMs ?? Number(process.env.PRIVATE_LLM_TIMEOUT_MS ?? 120000);
  }

  async embed(text: string): Promise<number[]> {
    const [embedding] = await this.embedMany([text]);
    return embedding;
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/v1/embeddings`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          'x-demo-name': this.demoName,
          'x-request-id': `ai-demo-embeddings-${requestId()}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          input: texts,
        }),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(
          `Private Mac embeddings failed with HTTP ${response.status}: ${body}`,
        );
      }
      const data = (await response.json()) as {
        data?: Array<{ embedding: number[] }>;
      };
      const rows = data?.data;
      if (!Array.isArray(rows)) {
        throw new Error(
          'Private Mac embeddings response did not include data[].',
        );
      }
      return rows.map((row) => row.embedding);
    } finally {
      clearTimeout(timeout);
    }
  }
}
