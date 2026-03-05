const API_BASE = '/api';

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('ligare_token', token);
    } else {
      localStorage.removeItem('ligare_token');
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('ligare_token');
    }
    return this.token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (res.status === 401) {
      this.setToken(null);
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(body.message || `Request failed: ${res.status}`);
    }

    if (res.headers.get('content-type')?.includes('text/csv')) {
      return (await res.text()) as unknown as T;
    }

    return res.json();
  }

  // Auth
  async login(email: string, password: string) {
    const data = await this.request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async me() {
    return this.request<any>('/auth/me');
  }

  logout() {
    this.setToken(null);
  }

  // Calls
  async getCalls(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<{ data: any[]; total: number; page: number; limit: number }>(`/calls${qs}`);
  }

  async getCall(id: string) {
    return this.request<any>(`/calls/${id}`);
  }

  async createCall(data: any) {
    return this.request<any>('/calls', { method: 'POST', body: JSON.stringify(data) });
  }

  async startCall(id: string) {
    return this.request<any>(`/calls/${id}/start`, { method: 'POST' });
  }

  async completeCall(id: string, notes?: string) {
    return this.request<any>(`/calls/${id}/complete`, { method: 'POST', body: JSON.stringify({ notes }) });
  }

  async transferCall(id: string, transferredTo: string, transferNotes?: string) {
    return this.request<any>(`/calls/${id}/transfer`, { method: 'POST', body: JSON.stringify({ transferredTo, transferNotes }) });
  }

  // Dashboard
  async getDashboard(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<any>(`/dashboard${qs}`);
  }

  // Exports
  async exportCalls(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    const token = this.getToken();
    const res = await fetch(`${API_BASE}/exports/calls.csv${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calls-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Users
  async getUsers(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<any[]>(`/users${qs}`);
  }

  async createUser(data: any) {
    return this.request<any>('/users', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateUser(id: string, data: any) {
    return this.request<any>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async deleteUser(id: string) {
    return this.request<any>(`/users/${id}`, { method: 'DELETE' });
  }

  // Categories
  async getCategories() {
    return this.request<any[]>('/categories');
  }

  async createCategory(data: any) {
    return this.request<any>('/categories', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateCategory(id: string, data: any) {
    return this.request<any>(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async deleteCategory(id: string) {
    return this.request<any>(`/categories/${id}`, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
