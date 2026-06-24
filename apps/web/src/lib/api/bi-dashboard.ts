// -----------------------------------------------------------------------------
// Cliente del dashboard guardado (Demo 10 sub-PR 4).
//
// 5 funciones HTTP simples:
//   - listBiDashboard()                — GET /bi/dashboard
//   - createBiDashboardItem(input)     — POST /bi/dashboard
//   - updateBiDashboardItem(id, patch) — PATCH /bi/dashboard/:id
//   - deleteBiDashboardItem(id)        — DELETE /bi/dashboard/:id
//   - executeBiDashboardItem(id)       — POST /bi/dashboard/:id/execute
// -----------------------------------------------------------------------------

import { ApiError, extractErrorMessage } from './client';
import type {
  BiDashboardItem,
  BiDashboardItemExecuteResult,
  CreateDashboardItemInput,
  UpdateDashboardItemInput,
} from './types-bi-dashboard';

const BASE = '/api/v1/bi/dashboard';

export async function listBiDashboard(
  signal?: AbortSignal,
): Promise<BiDashboardItem[]> {
  const r = await fetch(BASE, { signal });
  if (!r.ok) {
    const { message, payload } = await extractErrorMessage(r);
    throw new ApiError(message, r.status, payload);
  }
  return (await r.json()) as BiDashboardItem[];
}

export async function createBiDashboardItem(
  input: CreateDashboardItemInput,
  signal?: AbortSignal,
): Promise<BiDashboardItem> {
  const r = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  });
  if (!r.ok) {
    const { message, payload } = await extractErrorMessage(r);
    throw new ApiError(message, r.status, payload);
  }
  return (await r.json()) as BiDashboardItem;
}

export async function updateBiDashboardItem(
  id: string,
  patch: UpdateDashboardItemInput,
  signal?: AbortSignal,
): Promise<BiDashboardItem> {
  const r = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
    signal,
  });
  if (!r.ok) {
    const { message, payload } = await extractErrorMessage(r);
    throw new ApiError(message, r.status, payload);
  }
  return (await r.json()) as BiDashboardItem;
}

export async function deleteBiDashboardItem(
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  const r = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    signal,
  });
  if (!r.ok && r.status !== 204) {
    const { message, payload } = await extractErrorMessage(r);
    throw new ApiError(message, r.status, payload);
  }
}

export async function executeBiDashboardItem(
  id: string,
  signal?: AbortSignal,
): Promise<BiDashboardItemExecuteResult> {
  const r = await fetch(`${BASE}/${encodeURIComponent(id)}/execute`, {
    method: 'POST',
    signal,
  });
  if (!r.ok) {
    const { message, payload } = await extractErrorMessage(r);
    throw new ApiError(message, r.status, payload);
  }
  return (await r.json()) as BiDashboardItemExecuteResult;
}
