/** Typed fetch wrapper for `/api/v1`. Throws `ApiError` with the server's error shape. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get fieldErrors(): Record<string, string[]> {
    return (this.details as { fieldErrors?: Record<string, string[]> } | null)?.fieldErrors ?? {};
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

export async function api<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    method: init.method ?? 'GET',
    headers: init.body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: init.signal,
    credentials: 'same-origin',
  });
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => ({}))) as ErrorBody & T;
  if (!res.ok) {
    throw new ApiError(
      res.status,
      json.error?.code ?? 'UNKNOWN',
      json.error?.message ?? 'Request failed',
      json.error?.details ?? null,
    );
  }
  return json;
}

export const errorMessage = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
