import { AuthUser, CompanyRecord, LeadItem, ReviewItem, ContentPost } from '../types';

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
export async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
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

export async function fetchCompanyLeads(companyId?: string): Promise<LeadItem[]> {
  try {
    const url = companyId ? `/api/leads?companyId=${encodeURIComponent(companyId)}` : '/api/leads';
    const res = await apiRequest<{ success: boolean; leads: any[] }>(url);
    if (res.success && Array.isArray(res.leads)) {
      return res.leads.map((l) => ({
        id: l.id,
        name: l.name,
        phone: l.phone,
        serviceRequested: l.service || 'Service Inquiry',
        date: l.created_at ? new Date(l.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : 'Recently',
        source: (l.source?.includes('Google') ? 'Google Maps' : l.source?.includes('WhatsApp') ? 'WhatsApp Direct' : 'Website') as any,
        intentScore: l.intent_score || 85,
        stage: l.stage || 'new',
        notes: [l.company, l.budget, l.notes].filter(Boolean).join(' • '),
        aiSuggestedReply: l.ai_suggested_reply || '',
      }));
    }
    return [];
  } catch (err) {
    console.warn('Failed to fetch company leads:', err);
    return [];
  }
}

// ---------------- REVIEWS API CLIENT (MYSQL-BACKED) ---------------- //

export async function fetchCompanyReviews(companyId?: string): Promise<ReviewItem[]> {
  try {
    const url = companyId ? `/api/reviews?companyId=${encodeURIComponent(companyId)}` : '/api/reviews';
    const res = await apiRequest<{ success: boolean; reviews: any[] }>(url);
    if (res.success && Array.isArray(res.reviews)) {
      return res.reviews.map((r) => ({
        id: r.id,
        author: r.author,
        rating: Number(r.rating) || 5,
        date: r.date || 'Recent',
        relativeTime: r.relative_time || 'Recently',
        content: r.content,
        sentiment: r.sentiment || (r.rating >= 4 ? 'positive' : r.rating === 3 ? 'neutral' : 'negative'),
        topic: r.topic || 'General',
        isOperationalIssue: Boolean(r.is_operational_issue),
        replied: Boolean(r.replied),
        replyText: r.reply_text || undefined,
        replyDate: r.reply_date || undefined,
        source: r.source || 'google',
      }));
    }
    return [];
  } catch (err) {
    console.warn('Failed to fetch company reviews from MySQL:', err);
    return [];
  }
}

export async function createReviewApi(review: Partial<ReviewItem> & { companyId?: string }): Promise<ReviewItem | null> {
  try {
    const res = await apiRequest<{ success: boolean; review: any }>('/api/reviews', {
      method: 'POST',
      body: JSON.stringify({
        companyId: review.companyId,
        author: review.author,
        rating: review.rating,
        content: review.content,
        date: review.date,
        relative_time: review.relativeTime,
        sentiment: review.sentiment,
        topic: review.topic,
        is_operational_issue: review.isOperationalIssue,
        source: review.source || 'google',
      }),
    });
    if (res.success && res.review) {
      const r = res.review;
      return {
        id: r.id,
        author: r.author,
        rating: Number(r.rating) || 5,
        date: r.date,
        relativeTime: r.relative_time || 'Just now',
        content: r.content,
        sentiment: r.sentiment,
        topic: r.topic,
        isOperationalIssue: Boolean(r.is_operational_issue),
        replied: Boolean(r.replied),
        replyText: r.reply_text,
        replyDate: r.reply_date,
        source: r.source,
      };
    }
    return null;
  } catch (err) {
    console.warn('Failed to create review in MySQL:', err);
    return null;
  }
}

export async function replyToReviewApi(reviewId: string, replyText: string, companyId?: string): Promise<boolean> {
  try {
    const res = await apiRequest<{ success: boolean }>(`/api/reviews/${encodeURIComponent(reviewId)}/reply`, {
      method: 'POST',
      body: JSON.stringify({ replyText, companyId }),
    });
    return Boolean(res.success);
  } catch (err) {
    console.warn('Failed to save review reply to MySQL:', err);
    return false;
  }
}

export async function deleteReviewApi(reviewId: string, companyId?: string): Promise<boolean> {
  try {
    const url = companyId
      ? `/api/reviews/${encodeURIComponent(reviewId)}?companyId=${encodeURIComponent(companyId)}`
      : `/api/reviews/${encodeURIComponent(reviewId)}`;
    const res = await apiRequest<{ success: boolean }>(url, { method: 'DELETE' });
    return Boolean(res.success);
  } catch (err) {
    console.warn('Failed to delete review from MySQL:', err);
    return false;
  }
}

// ---------------- CONTENT POSTS API CLIENT (MYSQL-BACKED) ---------------- //

export async function fetchCompanyPosts(companyId?: string): Promise<ContentPost[]> {
  try {
    const url = companyId ? `/api/content-posts?companyId=${encodeURIComponent(companyId)}` : '/api/content-posts';
    const res = await apiRequest<{ success: boolean; posts: any[] }>(url);
    if (res.success && Array.isArray(res.posts)) {
      return res.posts.map((p) => ({
        id: p.id,
        title: p.title || 'Campaign Post',
        type: p.type || 'offer',
        platforms: Array.isArray(p.platforms) ? p.platforms : [p.channel || 'google'],
        headline: p.headline || '',
        caption: p.caption,
        cta: p.cta || '',
        hashtags: Array.isArray(p.hashtags) ? p.hashtags : [],
        imageUrl: p.image_url || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=600&q=80',
        status: p.status || 'scheduled',
        scheduledDate: p.scheduled_date || (p.scheduled_time ? p.scheduled_time.split(' ')[0] : 'Scheduled'),
        timeSlot: p.time_slot || '10:00 AM',
        reelScript: p.reel_script || undefined,
      }));
    }
    return [];
  } catch (err) {
    console.warn('Failed to fetch company content posts from MySQL:', err);
    return [];
  }
}

export async function createContentPostApi(post: Partial<ContentPost> & { companyId?: string }): Promise<ContentPost | null> {
  try {
    const res = await apiRequest<{ success: boolean; post: any }>('/api/content-posts', {
      method: 'POST',
      body: JSON.stringify({
        companyId: post.companyId,
        title: post.title,
        type: post.type,
        platforms: post.platforms,
        headline: post.headline,
        caption: post.caption,
        cta: post.cta,
        image_url: post.imageUrl,
        status: post.status,
        scheduled_date: post.scheduledDate,
        time_slot: post.timeSlot,
        hashtags: post.hashtags,
        reel_script: post.reelScript,
      }),
    });
    if (res.success && res.post) {
      const p = res.post;
      return {
        id: p.id,
        title: p.title || 'Campaign Post',
        type: p.type || 'offer',
        platforms: Array.isArray(p.platforms) ? p.platforms : [p.channel || 'google'],
        headline: p.headline || '',
        caption: p.caption,
        cta: p.cta || '',
        hashtags: Array.isArray(p.hashtags) ? p.hashtags : [],
        imageUrl: p.image_url,
        status: p.status,
        scheduledDate: p.scheduled_date,
        timeSlot: p.time_slot,
        reelScript: p.reel_script,
      };
    }
    return null;
  } catch (err) {
    console.warn('Failed to create content post in MySQL:', err);
    return null;
  }
}

export async function updatePostStatusApi(postId: string, status: string, companyId?: string): Promise<boolean> {
  try {
    const res = await apiRequest<{ success: boolean }>(`/api/content-posts/${encodeURIComponent(postId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, companyId }),
    });
    return Boolean(res.success);
  } catch (err) {
    console.warn('Failed to update post status in MySQL:', err);
    return false;
  }
}

export async function deleteContentPostApi(postId: string, companyId?: string): Promise<boolean> {
  try {
    const url = companyId
      ? `/api/content-posts/${encodeURIComponent(postId)}?companyId=${encodeURIComponent(companyId)}`
      : `/api/content-posts/${encodeURIComponent(postId)}`;
    const res = await apiRequest<{ success: boolean }>(url, { method: 'DELETE' });
    return Boolean(res.success);
  } catch (err) {
    console.warn('Failed to delete content post from MySQL:', err);
    return false;
  }
}

// ---------------- WHATSAPP CLOUD & RAZORPAY INTEGRATION SERVICES ---------------- //

export interface WhatsAppSendResult {
  success: boolean;
  method?: 'meta_cloud_api' | 'wa_link';
  messageId?: string;
  recipient?: string;
  message?: string;
  waLink?: string;
  error?: string;
  fallbackNotice?: string;
}

export async function sendWhatsAppMessageApi(payload: {
  to: string;
  message?: string;
  templateName?: string;
  languageCode?: string;
  companyId?: string;
}): Promise<WhatsAppSendResult> {
  try {
    const res = await apiRequest<WhatsAppSendResult>('/api/whatsapp/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res;
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to dispatch WhatsApp message',
    };
  }
}

export async function getWhatsAppStatusApi(companyId?: string): Promise<{
  configured: boolean;
  phoneNumberId?: string | null;
  wabaId?: string | null;
}> {
  try {
    const url = companyId ? `/api/whatsapp/status?companyId=${encodeURIComponent(companyId)}` : '/api/whatsapp/status';
    const res = await apiRequest<{ success: boolean; configured: boolean; phoneNumberId?: string; wabaId?: string }>(url);
    return {
      configured: Boolean(res.configured),
      phoneNumberId: res.phoneNumberId || null,
      wabaId: res.wabaId || null,
    };
  } catch {
    return { configured: false };
  }
}

export interface RazorpayOrderResult {
  success: boolean;
  order?: any;
  keyId?: string;
  mode?: string;
  error?: string;
}

export async function createRazorpayOrderApi(payload: {
  amount: number;
  currency?: string;
  receipt?: string;
  notes?: Record<string, any>;
  companyId?: string;
}): Promise<RazorpayOrderResult> {
  try {
    const res = await apiRequest<RazorpayOrderResult>('/api/razorpay/create-order', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to create Razorpay order' };
  }
}

export async function verifyRazorpayPaymentApi(payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature?: string;
  companyId?: string;
  leadId?: string;
  planName?: string;
  amount?: number;
}): Promise<{ success: boolean; verified: boolean; paymentId?: string; message?: string; error?: string }> {
  try {
    const res = await apiRequest<any>('/api/razorpay/verify-payment', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res;
  } catch (err: any) {
    return { success: false, verified: false, error: err?.message || 'Verification failed' };
  }
}

export async function createPaymentLinkApi(payload: {
  amount: number;
  description: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  companyId?: string;
  leadId?: string;
}): Promise<{
  success: boolean;
  shortUrl?: string;
  upiUri?: string;
  method?: string;
  amount?: number;
  error?: string;
}> {
  try {
    const res = await apiRequest<any>('/api/razorpay/create-payment-link', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to create payment link' };
  }
}

export async function getRazorpayStatusApi(companyId?: string): Promise<{
  configured: boolean;
  isLive: boolean;
  keyId?: string | null;
  mode: string;
}> {
  try {
    const url = companyId ? `/api/razorpay/status?companyId=${encodeURIComponent(companyId)}` : '/api/razorpay/status';
    const res = await apiRequest<{ success: boolean; configured: boolean; isLive: boolean; keyId?: string; mode: string }>(url);
    return {
      configured: Boolean(res.configured),
      isLive: Boolean(res.isLive),
      keyId: res.keyId || null,
      mode: res.mode || 'UNCONFIGURED',
    };
  } catch {
    return { configured: false, isLive: false, mode: 'UNCONFIGURED' };
  }
}



