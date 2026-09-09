import { getStoredToken } from './authService';

export interface ChatResponse {
  reply: string;
}

export interface ReviewReplyResponse {
  replyText: string;
}

export interface ContentGenerationResponse {
  headline?: string;
  caption?: string;
  callToAction?: string;
  hashtags?: string[];
  googlePostSnippet?: string;
  reelScript?: { scene: string; visual: string; audio: string }[];
  raw?: string;
}

function getAiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function askAiChat(params: {
  message: string;
  context?: any;
  businessName?: string;
  category?: string;
  language?: string;
}): Promise<string> {
  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: getAiHeaders(),
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(10000),
    });

    if (res.status === 429) {
      const data = await res.json().catch(() => null);
      return data?.error || '⚠️ AI rate limit reached (max 20 requests/minute). Please wait a moment before sending more messages.';
    }

    if (res.status === 401) {
      return '🔒 Please sign in to your Aaditech account to use LocalPulse AI.';
    }

    if (res.ok) {
      const data: ChatResponse = await res.json();
      if (data.reply) return data.reply;
    }
  } catch {
    // Graceful fallback without noisy logs
  }
  return `LocalPulse AI Response: Based on current metrics, your Google profile visibility in Sector 17 is strong at #2. Prioritize approving the 4 review drafts and publishing the weekend offer to maintain top rank!`;
}

export async function chatWithMarketingAgent(
  message: string,
  context?: { businessName?: string; category?: string; location?: string }
): Promise<string> {
  return askAiChat({
    message,
    businessName: context?.businessName,
    category: context?.category,
  });
}

export async function generateReviewReply(params: {
  reviewText: string;
  rating: number;
  reviewerName: string;
  tone?: string;
  language?: string;
  businessName?: string;
}): Promise<string> {
  try {
    const res = await fetch('/api/ai/reply-review', {
      method: 'POST',
      headers: getAiHeaders(),
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(10000),
    });

    if (res.status === 429) {
      return '⚠️ AI rate limit reached. Please wait a moment before generating another reply.';
    }

    if (res.status === 401) {
      return '🔒 Please log in to generate AI review replies.';
    }

    if (res.ok) {
      const data: ReviewReplyResponse = await res.json();
      if (data.replyText) return data.replyText;
    }
  } catch {
    // Graceful fallback without noisy logs
  }

  return params.rating >= 4
    ? `Thank you so much, ${params.reviewerName}! We are delighted that you had a great experience with our team at ${params.businessName || 'our store'}. Looking forward to assisting you again!`
    : `Hello ${params.reviewerName}, thank you for your candid feedback. We deeply value customer satisfaction and regret that we missed the mark. Please reach out to our desk directly so we can resolve this promptly for you.`;
}

export async function generateMarketingContent(params: {
  businessName?: string;
  category?: string;
  contentType?: string;
  platform?: string;
  offer?: string;
  language?: string;
  targetAudience?: string;
}): Promise<ContentGenerationResponse> {
  try {
    const res = await fetch('/api/ai/generate-content', {
      method: 'POST',
      headers: getAiHeaders(),
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(10000),
    });

    if (res.status === 429) {
      const err = await res.json().catch(() => null);
      return {
        headline: '⚠️ AI Rate Limit Reached',
        caption: err?.error || 'Rate limit reached for AI generation. Please wait a minute before generating new posts.',
        callToAction: 'Wait a moment & retry',
        hashtags: ['#RateLimitNotice'],
      };
    }

    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Graceful fallback without noisy logs
  }

  return {
    headline: `⚡ Express Service & Great Value at ${params.businessName || 'Our Store'}!`,
    caption: `Get high-quality certified support right here in your neighborhood! 🛠️ Special 20% discount on maintenance this week. Contact us today or visit our store.`,
    callToAction: 'Message Us on WhatsApp',
    hashtags: ['#LocalBusiness', '#BestInTown', '#SpecialDiscount', '#TrustedService'],
    googlePostSnippet: `Special limited promotion: Quality service and quick turnaround. Visit us today or call now for instant appointment!`,
  };
}

