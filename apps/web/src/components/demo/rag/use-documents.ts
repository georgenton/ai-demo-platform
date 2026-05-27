// -----------------------------------------------------------------------------
// useDocuments — hook para mantener la lista de documentos del demo activo.
//
// Encapsula:
//   - Carga inicial vía listDocuments({ demoId }).
//   - Estado loading / error / data.
//   - Acción `refresh()` para re-fetch (después de upload/delete).
//   - Acción `remove(id)` que llama deleteDocument + refresh.
//
// Sin librería de fetching (SWR / TanStack Query) porque la app es chica y
// estos endpoints se tocan solo en RAG/Compare. Cuando la cantidad de
// queries crezca podemos sumar una.
// -----------------------------------------------------------------------------

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  ApiError,
  deleteDocument,
  listDocuments,
  type DemoId,
  type DocumentSummary,
} from '@/lib/api';

export type DocumentsStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface UseDocumentsResult {
  documents: DocumentSummary[];
  status: DocumentsStatus;
  /** Mensaje legible si status === 'error'. */
  error: string | null;
  refresh: () => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const DEFAULT_LIMIT = 50;

export function useDocuments(demoId: DemoId): UseDocumentsResult {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [status, setStatus] = useState<DocumentsStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // AbortController para cancelar fetches en vuelo si el componente se
  // desmonta o el demoId cambia. Sin esto, podríamos hacer setState sobre
  // un componente desmontado.
  const abortRef = useRef<AbortController | null>(null);

  const fetchDocuments = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus('loading');
    setError(null);
    try {
      const result = await listDocuments(
        { demoId, limit: DEFAULT_LIMIT },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setDocuments(result.items);
      setStatus('ready');
    } catch (err) {
      if (controller.signal.aborted) return;
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Error desconocido al cargar documentos';
      setError(message);
      setStatus('error');
    }
  }, [demoId]);

  useEffect(() => {
    fetchDocuments();
    return () => abortRef.current?.abort();
  }, [fetchDocuments]);

  const remove = useCallback(
    async (id: string) => {
      // Optimistic UI: sacamos el doc del array inmediatamente. Si la
      // llamada falla, lo restauramos y mostramos el error.
      const previous = documents;
      setDocuments((docs) => docs.filter((d) => d.id !== id));
      try {
        await deleteDocument(id);
      } catch (err) {
        setDocuments(previous);
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Error al borrar el documento';
        setError(message);
      }
    },
    [documents],
  );

  return {
    documents,
    status,
    error,
    refresh: fetchDocuments,
    remove,
  };
}
