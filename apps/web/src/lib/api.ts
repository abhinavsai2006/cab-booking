const DEFAULT_API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const role = localStorage.getItem('cab_active_role') || 'RIDER';
  const userId = localStorage.getItem('cab_active_user_id') || '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-user-role': role,
    Authorization: `demo_${role.toLowerCase()}`,
  };

  if (userId) {
    headers['x-user-id'] = userId;
  }

  return headers;
}

async function fetchWithFallback(endpoint: string, options: RequestInit): Promise<Response> {
  const isBrowser = typeof window !== 'undefined';
  const urlsToTry = isBrowser
    ? [`/api/v1${endpoint}`, `${DEFAULT_API_BASE}/api/v1${endpoint}`, `http://127.0.0.1:4000/api/v1${endpoint}`]
    : [`${DEFAULT_API_BASE}/api/v1${endpoint}`, `http://127.0.0.1:4000/api/v1${endpoint}`];

  let lastRes: Response | null = null;
  let lastError: any;

  for (const url of urlsToTry) {
    try {
      const res = await fetch(url, options);
      // If the Next.js relative rewrite isn't active yet and returns 404, fall through to direct backend
      if (res.status === 404 && url.startsWith('/api/v1')) {
        lastRes = res;
        continue;
      }
      return res;
    } catch (err: any) {
      lastError = err;
    }
  }

  if (lastRes) return lastRes;
  throw lastError || new Error('Failed to connect to API server. Ensure the backend is running on port 4000.');
}

export const api = {
  async get<T = any>(endpoint: string): Promise<T> {
    const res = await fetchWithFallback(endpoint, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }
    return res.json();
  },

  async post<T = any>(endpoint: string, body?: any): Promise<T> {
    const res = await fetchWithFallback(endpoint, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }
    return res.json();
  },

  async patch<T = any>(endpoint: string, body?: any): Promise<T> {
    const res = await fetchWithFallback(endpoint, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }
    return res.json();
  },

  async delete<T = any>(endpoint: string): Promise<T> {
    const res = await fetchWithFallback(endpoint, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }
    return res.json();
  },
};
