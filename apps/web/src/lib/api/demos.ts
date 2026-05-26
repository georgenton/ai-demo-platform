// Cliente de los endpoints /api/v1/demos.

import { ApiError, extractErrorMessage } from './client';
import type { DemoMetadata } from './types-demos';

/** GET /api/v1/demos — catálogo completo. */
export async function listDemos(signal?: AbortSignal): Promise<DemoMetadata[]> {
  const response = await fetch('/api/v1/demos', { signal });
  if (!response.ok) {
    const { message, payload } = await extractErrorMessage(response);
    throw new ApiError(message, response.status, payload);
  }
  return (await response.json()) as DemoMetadata[];
}

/** GET /api/v1/demos/:id — detalle (404 → ApiError). */
export async function getDemo(
  id: string,
  signal?: AbortSignal,
): Promise<DemoMetadata> {
  const response = await fetch(`/api/v1/demos/${encodeURIComponent(id)}`, {
    signal,
  });
  if (!response.ok) {
    const { message, payload } = await extractErrorMessage(response);
    throw new ApiError(message, response.status, payload);
  }
  return (await response.json()) as DemoMetadata;
}
