import { AuthUser, CompanyRecord } from '../types';

const TOKEN_KEY = 'abga_auth_token';
const USER_KEY = 'abga_user_profile';
const ACTIVE_COMPANY_KEY = 'abga_active_company_id';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredSession(token: string, user: AuthUser) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (err) {
    console.warn('Failed to save session to localStorage:', err);
  }
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearStoredSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ACTIVE_COMPANY_KEY);
  } catch (err) {
    console.warn('Failed to clear session:', err);
  }
}

export function getStoredActiveCompanyId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_COMPANY_KEY);
  } catch {
    return null;
  }
}

export function setStoredActiveCompanyId(companyId: string) {
  try {
    localStorage.setItem(ACTIVE_COMPANY_KEY, companyId);
  } catch (err) {
    console.warn('Failed to save active company ID:', err);
  }
}

// Fetch helper with Authorization Bearer header
async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }
  return data;
}

// ---------------- AUTH APIS ---------------- //

export async function loginUser(credentials: { email: string; password: string }): Promise<{ user: AuthUser; token: string }> {
  const res = await apiRequest<{ success: boolean; user: AuthUser; token: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
  setStoredSession(res.token, res.user);
  return { user: res.user, token: res.token };
}

export async function registerUser(data: {
  email: string;
  password: string;
  full_name: string;
  role?: 'owner' | 'manager' | 'agency';
}): Promise<{ user: AuthUser; token: string }> {
  const res = await apiRequest<{ success: boolean; user: AuthUser; token: string }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  setStoredSession(res.token, res.user);
  return { user: res.user, token: res.token };
}

export async function checkAuthSession(): Promise<AuthUser | null> {
  const token = getStoredToken();
  if (!token) return null;

  try {
    const res = await apiRequest<{ success: boolean; user: AuthUser }>('/api/auth/me');
    if (res.success && res.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
      return res.user;
    }
  } catch {
    clearStoredSession();
  }
  return null;
}

// ---------------- COMPANY MANAGEMENT APIS ---------------- //

export async function fetchUserCompanies(): Promise<CompanyRecord[]> {
  try {
    const res = await apiRequest<{ success: boolean; companies: CompanyRecord[] }>('/api/companies');
    return res.companies || [];
  } catch (err) {
    console.warn('Failed to fetch user companies:', err);
    return [];
  }
}

export async function createCompanyApi(data: {
  name: string;
  legal_name?: string;
  category: string;
  city: string;
  phone?: string;
  website?: string;
  google_place_id?: string;
}): Promise<CompanyRecord> {
  const res = await apiRequest<{ success: boolean; company: CompanyRecord }>('/api/companies', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.company;
}

export async function fetchCompanyData(companyId: string): Promise<any | null> {
  try {
    const res = await apiRequest<{ success: boolean; company: CompanyRecord; data: any }>(`/api/companies/${companyId}/data`);
    return res.data || null;
  } catch (err) {
    console.warn('Failed to fetch company data:', err);
    return null;
  }
}

export async function saveCompanyData(companyId: string, payload: any): Promise<boolean> {
  try {
    await apiRequest<{ success: boolean }>(`/api/companies/${companyId}/data`, {
      method: 'PUT',
      body: JSON.stringify({ data: payload }),
    });
    return true;
  } catch (err) {
    console.warn('Failed to save company data:', err);
    return false;
  }
}
