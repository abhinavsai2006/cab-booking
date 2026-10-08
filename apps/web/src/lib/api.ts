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
  
  // Prefer direct API connection first to bypass Next.js dev server proxy hiccups on Windows
  const urlsToTry = isBrowser
    ? [
        `${DEFAULT_API_BASE}/api/v1${endpoint}`,
        `http://127.0.0.1:4000/api/v1${endpoint}`,
        `/api/v1${endpoint}`,
      ]
    : [
        `${DEFAULT_API_BASE}/api/v1${endpoint}`,
        `http://127.0.0.1:4000/api/v1${endpoint}`,
      ];

  let lastRes: Response | null = null;
  let lastError: any;

  for (const url of urlsToTry) {
    try {
      const res = await fetch(url, options);
      // If we got a 5xx from an intermediate proxy or 404 on relative proxy, try the other candidates
      if ((res.status >= 500 || res.status === 404) && urlsToTry.length > 1) {
        lastRes = res;
        continue;
      }
      return res;
    } catch (err: any) {
      lastError = err;
    }
  }

  if (lastRes) return lastRes;
  throw lastError || new Error('Failed to connect to API server. Ensure backend is running on port 4000.');
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let message = '';
    try {
      const json = JSON.parse(text);
      message = json.error?.message || json.message || (typeof json.error === 'string' ? json.error : '');
    } catch {
      message = text.slice(0, 300);
    }
    throw new Error(message || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  async get<T = any>(endpoint: string): Promise<T> {
    const res = await fetchWithFallback(endpoint, {
      headers: getAuthHeaders(),
    });
    return handleResponse<T>(res);
  },

  async post<T = any>(endpoint: string, body?: any): Promise<T> {
    const res = await fetchWithFallback(endpoint, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(res);
  },

  async patch<T = any>(endpoint: string, body?: any): Promise<T> {
    const res = await fetchWithFallback(endpoint, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(res);
  },

  async delete<T = any>(endpoint: string): Promise<T> {
    const res = await fetchWithFallback(endpoint, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse<T>(res);
  },
};
