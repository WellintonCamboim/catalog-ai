const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';
const TOKEN_KEY = 'token';

export class ApiError extends Error {
  status: number;
  details?: Record<string, string[]>;

  constructor(status: number, message: string, details?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage unavailable: the session just won't survive a reload */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

export function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = tokenStore.get();
  return { ...extra, ...(token && { Authorization: `Bearer ${token}` }) };
}

export async function toApiError(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => null);
  const error = body?.error;
  if (res.status === 401 && tokenStore.get()) onUnauthorized();
  return new ApiError(res.status, error?.message ?? 'Erro inesperado', error?.details);
}

export async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; query?: Record<string, string | number | undefined> } = {},
): Promise<T> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(options.query ?? {})) {
    if (v !== undefined && v !== '') params.set(k, String(v));
  }
  const qs = params.size > 0 ? `?${params}` : '';

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}${qs}`, {
      method: options.method ?? 'GET',
      headers: authHeaders(options.body ? { 'Content-Type': 'application/json' } : {}),
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Não foi possível conectar ao servidor');
  }

  if (!res.ok) throw await toApiError(res);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export { BASE_URL };
