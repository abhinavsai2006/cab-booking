const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

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

export const api = {
  async get<T = any>(endpoint: string): Promise<T> {
    const res = await fetch(`${API_BASE}/api/v1${endpoint}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }
    return res.json();
  },

  async post<T = any>(endpoint: string, body?: any): Promise<T> {
    const res = await fetch(`${API_BASE}/api/v1${endpoint}`, {
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
    const res = await fetch(`${API_BASE}/api/v1${endpoint}`, {
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
    const res = await fetch(`${API_BASE}/api/v1${endpoint}`, {
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
