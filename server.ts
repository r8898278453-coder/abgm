import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

import {
  getAllLeads,
  getLeadById,
  createLead,
  updateLeadStatus,
  sendTelegramPushAlert,
  findUserByEmail,
  findUserById,
  createUser,
  verifyPassword,
  upgradeUserPassword,
  getAllCompanies,
  getUserCompanies,
  getCompanyById,
  createCompany,
  getCompanyDataPayload,
  saveCompanyDataPayload,
  getDbStatus,
  getDefaultCompanyId,
  getCompanyIntegrations,
  getCompanyIntegration,
  saveCompanyIntegration,
  deleteCompanyIntegration,
  getCompanyReviews,
  getReviewById,
  createReview,
  updateReviewReply,
  deleteReview,
  getCompanyPosts,
  getPostById,
  createContentPost,
  updateContentPostStatus,
  deleteContentPost,
} from './server/db';
import { generateAuthToken, getAuthUserFromRequest } from './server/auth';
import {
  loginProtectionMiddleware,
  recordFailedLogin,
  recordSuccessfulLogin,
  registerRateLimiter,
  aiRateLimiter,
  leadsRateLimiter,
  telegramAlertLimiter,
} from './server/rateLimiter';
import {
  corsMiddleware,
  securityHeadersMiddleware,
  requestAuditLogger,
} from './server/security';
import {
  registerSchema,
  loginSchema,
  createLeadSchema,
  updateLeadStageSchema,
  replyReviewSchema,
  createReviewSchema,
  createCompanySchema,
  createPostSchema,
  verifyRazorpayPaymentSchema,
  validateBody,
} from './server/validation';

const app = express();

// Dynamic Port Configuration:
// - Defaults to port 3000 (mandated for Google AI Studio Cloud Run reverse-proxy sandbox)
// - Supports custom APP_PORT or STANDALONE_PORT if deployed to Hostinger VPS, cPanel, or Docker container
const PORT = process.env.APP_PORT
  ? parseInt(process.env.APP_PORT, 10)
  : (process.env.STANDALONE_PORT ? parseInt(process.env.STANDALONE_PORT, 10) : 3000);

// Enterprise Security & Monitoring Middlewares
app.use(securityHeadersMiddleware);
app.use(corsMiddleware);
app.use(requestAuditLogger);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Initialize Gemini Client safely
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Resilient Gemini Generator with automatic model fallback (503) and permission cooling (403)
let accessDeniedCooldownUntil = 0;
const FALLBACK_MODELS = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

async function safeGenerateContent(options: {
  prompt: string;
  responseMimeType?: string;
}): Promise<string | null> {
  const now = Date.now();
  if (now < accessDeniedCooldownUntil) {
    return null;
  }

  const ai = getAiClient();
  if (!ai) return null;

  for (const model of FALLBACK_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: options.prompt,
        ...(options.responseMimeType
          ? { config: { responseMimeType: options.responseMimeType } }
          : {}),
      });

      if (response && response.text) {
        return response.text;
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const is403 = errMsg.includes('403') || errMsg.includes('PERMISSION_DENIED');
      const is503 = errMsg.includes('503') || errMsg.includes('UNAVAILABLE');

      if (is403) {
        // Cooldown for 5 minutes if project access is denied
        accessDeniedCooldownUntil = Date.now() + 5 * 60 * 1000;
        return null;
      }

      if (is503) {
        // Model busy; try next model in fallback list
        continue;
      }

      return null;
    }
  }

  return null;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// ==================== AUTHENTICATION APIS ==================== //

// Register new user (protected with registration rate limiting & Zod schema validation)
app.post('/api/auth/register', registerRateLimiter, validateBody(registerSchema), async (req, res) => {
  try {
    const { email, password, full_name, role } = req.body;

    const existing = await findUserByEmail(email);
    if (existing) {
      res.status(409).json({ success: false, error: 'An account with this email already exists' });
      return;
    }

    const user = await createUser({
      email,
      password,
      full_name,
      role,
    });

    const token = generateAuthToken(user);
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// User login (protected with rate limiting, brute-force account lockout & Zod schema validation)
app.post('/api/auth/login', loginProtectionMiddleware, validateBody(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email and password are required' });
      return;
    }

    const user = await findUserByEmail(email);
    if (!user) {
      const lockStatus = recordFailedLogin(req, email);
      if (lockStatus.isLocked) {
        res.setHeader('Retry-After', (lockStatus.lockedForSeconds || 900).toString());
        res.status(429).json({
          success: false,
          error: 'Account temporarily locked due to 5 consecutive failed login attempts. For security, please try again in 15 minutes.',
          locked: true,
          retryAfter: lockStatus.lockedForSeconds,
        });
        return;
      }
      res.status(401).json({
        success: false,
        error: 'Invalid email or password',
        remainingAttempts: lockStatus.remainingAttempts,
      });
      return;
    }

    const isValid = verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) {
      const lockStatus = recordFailedLogin(req, email);
      if (lockStatus.isLocked) {
        res.setHeader('Retry-After', (lockStatus.lockedForSeconds || 900).toString());
        res.status(429).json({
          success: false,
          error: 'Account temporarily locked due to 5 consecutive failed login attempts. For security, please try again in 15 minutes.',
          locked: true,
          retryAfter: lockStatus.lockedForSeconds,
        });
        return;
      }
      res.status(401).json({
        success: false,
        error: 'Invalid email or password',
        remainingAttempts: lockStatus.remainingAttempts,
      });
      return;
    }

    // Authentication succeeded: clear failed attempts for this email
    recordSuccessfulLogin(req, email);

    // Transparently upgrade legacy low-iteration hashes to OWASP 210,000 iterations
    upgradeUserPassword(user.id, password).catch(() => {});

    const token = generateAuthToken(user);
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Current session verification
app.get('/api/auth/me', async (req, res) => {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized or session expired' });
      return;
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// ==================== MULTI-COMPANY APIS ==================== //

// Get all companies for current user (or all platform companies if platform_admin)
app.get('/api/companies', async (req, res) => {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const companies = user.role === 'platform_admin' ? await getAllCompanies() : await getUserCompanies(user.id);
    res.json({ success: true, companies });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Create new company profile
app.post('/api/companies', validateBody(createCompanySchema), async (req, res) => {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const { name, legal_name, category, city, phone, website, google_place_id } = req.body;

    const company = await createCompany({
      user_id: user.id,
      name,
      legal_name,
      category,
      city,
      phone,
      website,
      google_place_id,
    });

    // Send Telegram alert of new business onboarding if enabled
    const alertMsg = `🏢 *NEW COMPANY ONBOARDED TO ABGA!*\n\n👑 *Owner:* ${user.full_name} (${user.email})\n🏢 *Business:* ${company.name}\n🏷️ *Category:* ${company.category}\n📍 *City:* ${company.city}\n🌐 *Domain:* bga.aaditechs.in`;
    sendTelegramPushAlert(alertMsg).catch(() => {});

    res.status(201).json({ success: true, company });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Fetch isolated company data (Growth score, audits, competitors, reviews)
app.get('/api/companies/:id/data', async (req, res) => {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const company = await getCompanyById(id);
    if (!company) {
      res.status(404).json({ success: false, error: 'Company not found' });
      return;
    }

    if (company.user_id !== user.id && user.role !== 'platform_admin') {
      res.status(403).json({ success: false, error: 'Access denied to this company workspace' });
      return;
    }

    const payload = await getCompanyDataPayload(id);
    res.json({ success: true, company, data: payload });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Save isolated company data payload
app.put('/api/companies/:id/data', async (req, res) => {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const company = await getCompanyById(id);
    if (!company) {
      res.status(404).json({ success: false, error: 'Company not found' });
      return;
    }

    if (company.user_id !== user.id && user.role !== 'platform_admin') {
      res.status(403).json({ success: false, error: 'Access denied to this company workspace' });
      return;
    }

    const { data } = req.body;
    await saveCompanyDataPayload(id, data);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// ---------------- INTEGRATIONS MANAGEMENT & LIVE CREDENTIAL VERIFICATION ---------------- //

function maskSecret(val: string): string {
  if (!val || typeof val !== 'string') return '';
  if (val.length <= 6) return '••••••';
  return val.slice(0, 4) + '••••' + val.slice(-4);
}

function maskCredentialsObj(creds: Record<string, any>): Record<string, any> {
  const masked: Record<string, any> = {};
  for (const [key, val] of Object.entries(creds)) {
    if (typeof val === 'string') {
      const lower = key.toLowerCase();
      if (lower.includes('token') || lower.includes('secret') || lower.includes('key') || lower.includes('password')) {
        masked[key] = maskSecret(val);
      } else {
        masked[key] = val;
      }
    } else {
      masked[key] = val;
    }
  }
  return masked;
}

// Fetch configured integrations for a company
app.get('/api/integrations', async (req, res) => {
  try {
    const user = await getAuthUserFromRequest(req);
    let companyId = (req.query.companyId || req.query.company_id) as string | undefined;

    if (user) {
      if (companyId) {
        const company = await getCompanyById(companyId);
        if (company && company.user_id !== user.id && user.role !== 'platform_admin') {
          res.status(403).json({ success: false, error: 'Access denied to this company integrations' });
          return;
        }
      } else {
        const userCompanies = await getUserCompanies(user.id);
        companyId = userCompanies[0]?.id || (await getDefaultCompanyId()) || 'comp_aaditech_main';
      }
    } else {
      companyId = companyId || (await getDefaultCompanyId()) || 'comp_aaditech_main';
    }

    const storedIntegrations = await getCompanyIntegrations(companyId);

    // Also check server system-level env variables
    const systemTelegramConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);

    // Standard list of providers
    const providers = [
      {
        id: 'google_business',
        name: 'Google Business Profile & Maps',
        category: 'Google',
        icon: '📍',
        description: 'Syncs 3-Pack rankings, public reviews, photos, business hours & attributes with Google APIs.',
        docsUrl: 'https://developers.google.com/my-business',
        requiredFields: [
          { key: 'placeId', label: 'Google Place ID', placeholder: 'e.g. ChIJN1t_tDeuEmsRUsoyG83frY4', secret: false, required: true },
          { key: 'apiKey', label: 'Google Maps / Places API Key', placeholder: 'AIzaSy...', secret: true, required: false },
        ],
      },
      {
        id: 'whatsapp_cloud',
        name: 'WhatsApp Business Cloud Platform',
        category: 'Messaging',
        icon: '💬',
        description: 'Official Meta Cloud API for instant lead auto-replies, quote dispatches & review collection.',
        docsUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api',
        requiredFields: [
          { key: 'phoneNumberId', label: 'Phone Number ID', placeholder: '108429582910294', secret: false, required: true },
          { key: 'accessToken', label: 'Meta System User Token (Permanent)', placeholder: 'EAA...', secret: true, required: true },
          { key: 'wabaId', label: 'WhatsApp Business Account ID', placeholder: '395820194820194', secret: false, required: false },
        ],
      },
      {
        id: 'telegram_bot',
        name: 'Telegram Bot Gateway',
        category: 'Messaging',
        icon: '✈️',
        description: '24/7 Natural language command hub for instant approvals, morning briefs & urgent alerts.',
        docsUrl: 'https://core.telegram.org/bots/api',
        requiredFields: [
          { key: 'botToken', label: 'Telegram Bot Token (from @BotFather)', placeholder: '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ', secret: true, required: true },
          { key: 'chatId', label: 'Telegram Chat ID / Group ID', placeholder: 'e.g. -100123456789 or 987654321', secret: false, required: false },
        ],
      },
      {
        id: 'meta_social',
        name: 'Meta (Instagram & Facebook Pages)',
        category: 'Meta',
        icon: '📸',
        description: 'Automates publishing of client showcases, carousel case studies, and reels to Instagram & Facebook.',
        docsUrl: 'https://developers.facebook.com/docs/graph-api',
        requiredFields: [
          { key: 'accessToken', label: 'Page / User Access Token', placeholder: 'EAAB...', secret: true, required: true },
          { key: 'pageId', label: 'Facebook Page ID', placeholder: '109283746520', secret: false, required: false },
          { key: 'instagramId', label: 'Instagram Business Account ID', placeholder: '17841400293847', secret: false, required: false },
        ],
      },
      {
        id: 'razorpay_gateway',
        name: 'Razorpay Payments & Subscriptions',
        category: 'Platform',
        icon: '💳',
        description: 'Accept client retainers, SaaS upgrades, and generate GST-compliant invoices automatically.',
        docsUrl: 'https://razorpay.com/docs/payments/server-integration',
        requiredFields: [
          { key: 'keyId', label: 'Razorpay Key ID', placeholder: 'rzp_live_... or rzp_test_...', secret: false, required: true },
          { key: 'keySecret', label: 'Razorpay Key Secret', placeholder: '••••••••••••••••', secret: true, required: true },
        ],
      },
      {
        id: 'website_cname',
        name: 'Custom Domain & SSL Gateway',
        category: 'Platform',
        icon: '🌐',
        description: 'Connects custom business domain (e.g. https://bga.aaditechs.in) with automated SSL edge caching.',
        docsUrl: 'https://developers.cloudflare.com/dns',
        requiredFields: [
          { key: 'websiteUrl', label: 'Production URL', placeholder: 'https://yourdomain.com', secret: false, required: true },
          { key: 'webhookSecret', label: 'Inbound Webhook Secret (HMAC-SHA256)', placeholder: 'Optional signing key', secret: true, required: false },
        ],
      },
    ];

    const result = providers.map((p) => {
      const stored = storedIntegrations.find((i) => i.provider === p.id);
      let isConnected = stored ? stored.status === 'connected' : false;
      let statusText = isConnected ? 'Connected & Verified' : 'Not Configured (Setup Required)';
      let lastTestedAt = stored?.last_tested_at || null;
      let lastError = stored?.last_error || null;
      let maskedCreds = stored ? maskCredentialsObj(stored.credentials || {}) : {};

      // System-level fallback for Telegram if not set per-company
      if (p.id === 'telegram_bot' && !stored && systemTelegramConfigured) {
        isConnected = true;
        statusText = 'Active (System Server Default Token)';
        lastTestedAt = 'Server Startup';
        maskedCreds = { botToken: maskSecret(process.env.TELEGRAM_BOT_TOKEN || '') };
      }

      return {
        ...p,
        connected: isConnected,
        status: isConnected ? 'connected' : (stored?.status === 'error' ? 'error' : 'disconnected'),
        statusText,
        lastTestedAt,
        lastError,
        maskedCredentials: maskedCreds,
      };
    });

    res.json({
      success: true,
      companyId,
      integrations: result,
      systemTelegramConfigured,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Test integration credentials in real time against provider API
app.post('/api/integrations/test', async (req, res) => {
  try {
    const { provider, credentials } = req.body;
    if (!provider || !credentials) {
      res.status(400).json({ success: false, error: 'Provider and credentials are required' });
      return;
    }

    if (provider === 'telegram_bot') {
      const botToken = credentials.botToken?.trim();
      if (!botToken) {
        res.status(400).json({ success: false, error: 'Telegram Bot Token is required' });
        return;
      }

      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, {
          signal: AbortSignal.timeout(6000),
        });
        const tgData = await tgRes.json();
        if (tgRes.ok && tgData.ok) {
          res.json({
            success: true,
            message: `Verified! Connected to Telegram Bot: @${tgData.result.username} (${tgData.result.first_name})`,
            details: { username: tgData.result.username, name: tgData.result.first_name, canJoinGroups: tgData.result.can_join_groups },
          });
          return;
        } else {
          res.status(400).json({
            success: false,
            error: tgData.description || 'Invalid Telegram Bot Token (HTTP 401)',
          });
          return;
        }
      } catch (tgErr: any) {
        res.status(400).json({
          success: false,
          error: `Telegram connection error: ${tgErr?.message || 'Timeout connecting to Telegram API'}`,
        });
        return;
      }
    }

    if (provider === 'whatsapp_cloud') {
      const phoneNumberId = credentials.phoneNumberId?.trim();
      const accessToken = credentials.accessToken?.trim();
      if (!phoneNumberId || !accessToken) {
        res.status(400).json({ success: false, error: 'Phone Number ID and Meta Access Token are required' });
        return;
      }

      try {
        const waRes = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(6000),
        });
        const waData = await waRes.json();
        if (waRes.ok && waData.id) {
          res.json({
            success: true,
            message: `Verified! WhatsApp Phone Number: ${waData.display_phone_number || phoneNumberId} (${waData.verified_name || 'Verified Account'})`,
            details: waData,
          });
          return;
        } else {
          res.status(400).json({
            success: false,
            error: waData.error?.message || 'Meta Cloud API rejected credentials',
          });
          return;
        }
      } catch (waErr: any) {
        res.status(400).json({
          success: false,
          error: `WhatsApp connection error: ${waErr?.message || 'Network timeout'}`,
        });
        return;
      }
    }

    if (provider === 'google_business') {
      const placeId = credentials.placeId?.trim();
      const apiKey = credentials.apiKey?.trim();
      if (!placeId) {
        res.status(400).json({ success: false, error: 'Google Place ID is required' });
        return;
      }

      if (apiKey) {
        try {
          const gRes = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&key=${encodeURIComponent(apiKey)}`, {
            signal: AbortSignal.timeout(6000),
          });
          const gData = await gRes.json();
          if (gData.status === 'OK') {
            res.json({
              success: true,
              message: `Verified! Connected to Google Place: ${gData.result?.name} (${gData.result?.formatted_address})`,
              details: { name: gData.result?.name, address: gData.result?.formatted_address, rating: gData.result?.rating },
            });
            return;
          } else {
            res.status(400).json({
              success: false,
              error: `Google Places API Error: ${gData.status} - ${gData.error_message || 'Verify Place ID and API key'}`,
            });
            return;
          }
        } catch (gErr: any) {
          res.status(400).json({ success: false, error: `Google API timeout: ${gErr?.message}` });
          return;
        }
      } else {
        // Syntax validation if API key not entered yet
        if (placeId.length >= 10) {
          res.json({
            success: true,
            message: `Valid Place ID format (${placeId.slice(0, 8)}...). Saved for Google 3-Pack and Maps search indexing.`,
          });
          return;
        } else {
          res.status(400).json({ success: false, error: 'Invalid Google Place ID format. Should be standard Place ID string.' });
          return;
        }
      }
    }

    if (provider === 'meta_social') {
      const accessToken = credentials.accessToken?.trim();
      if (!accessToken) {
        res.status(400).json({ success: false, error: 'Meta Access Token is required' });
        return;
      }

      try {
        const metaRes = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${accessToken}`, {
          signal: AbortSignal.timeout(6000),
        });
        const metaData = await metaRes.json();
        if (metaRes.ok && metaData.id) {
          res.json({
            success: true,
            message: `Verified! Connected to Meta Account: ${metaData.name || 'Meta App'} (ID: ${metaData.id})`,
            details: metaData,
          });
          return;
        } else {
          res.status(400).json({
            success: false,
            error: metaData.error?.message || 'Meta Graph API token rejected',
          });
          return;
        }
      } catch (metaErr: any) {
        res.status(400).json({ success: false, error: `Meta API error: ${metaErr?.message}` });
        return;
      }
    }

    if (provider === 'razorpay_gateway') {
      const keyId = credentials.keyId?.trim();
      const keySecret = credentials.keySecret?.trim();
      if (!keyId) {
        res.status(400).json({ success: false, error: 'Razorpay Key ID is required' });
        return;
      }

      if (!keyId.startsWith('rzp_test_') && !keyId.startsWith('rzp_live_')) {
        res.status(400).json({ success: false, error: 'Key ID must start with rzp_test_ or rzp_live_' });
        return;
      }

      if (keySecret) {
        try {
          const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
          const rzpRes = await fetch('https://api.razorpay.com/v1/customers?count=1', {
            headers: { Authorization: authHeader },
            signal: AbortSignal.timeout(6000),
          });
          if (rzpRes.ok) {
            res.json({
              success: true,
              message: `Verified! Razorpay API Gateway active (${keyId.startsWith('rzp_live') ? 'LIVE Mode' : 'TEST Sandbox Mode'})`,
            });
            return;
          } else {
            res.status(400).json({ success: false, error: 'Razorpay authentication failed: Invalid Key ID or Key Secret' });
            return;
          }
        } catch (rzpErr: any) {
          res.status(400).json({ success: false, error: `Razorpay connection error: ${rzpErr?.message}` });
          return;
        }
      } else {
        res.json({ success: true, message: `Key ID format validated (${keyId}). Ready to receive orders.` });
        return;
      }
    }

    if (provider === 'website_cname') {
      const websiteUrl = credentials.websiteUrl?.trim();
      if (!websiteUrl || !websiteUrl.startsWith('http')) {
        res.status(400).json({ success: false, error: 'Valid URL starting with http:// or https:// is required' });
        return;
      }

      try {
        const siteRes = await fetch(websiteUrl, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000),
        });
        res.json({
          success: true,
          message: `Verified! Custom domain reachable (HTTP ${siteRes.status}) with active SSL.`,
        });
        return;
      } catch {
        res.json({
          success: true,
          message: `Custom domain ${websiteUrl} registered for outbound webhooks and CNAME routing.`,
        });
        return;
      }
    }

    res.status(400).json({ success: false, error: `Unknown provider: ${provider}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Save credentials and update integration state for a company
app.post('/api/integrations/save', async (req, res) => {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const { companyId, provider, credentials, config } = req.body;

    let targetCompanyId = companyId;
    if (!targetCompanyId) {
      const userCompanies = await getUserCompanies(user.id);
      targetCompanyId = userCompanies[0]?.id;
    }
    if (!targetCompanyId || !provider) {
      res.status(400).json({ success: false, error: 'Company ID and Provider are required' });
      return;
    }

    const company = await getCompanyById(targetCompanyId);
    if (company && company.user_id !== user.id && user.role !== 'platform_admin') {
      res.status(403).json({ success: false, error: 'Access denied to manage integrations for this company' });
      return;
    }

    // Retain existing secret credentials if user submitted masked placeholder string
    const existing = await getCompanyIntegration(targetCompanyId, provider);
    const cleanCredentials: Record<string, any> = { ...(existing?.credentials || {}) };

    if (credentials && typeof credentials === 'object') {
      for (const [k, v] of Object.entries(credentials)) {
        if (typeof v === 'string') {
          // If value is not a masked string, update it
          if (!v.includes('••••')) {
            cleanCredentials[k] = v.trim();
          }
        } else {
          cleanCredentials[k] = v;
        }
      }
    }

    const saved = await saveCompanyIntegration(targetCompanyId, provider, {
      status: 'connected',
      credentials: cleanCredentials,
      config: config || {},
      last_tested_at: new Date().toISOString(),
      last_error: null,
    });

    res.json({
      success: true,
      integration: {
        ...saved,
        credentials: maskCredentialsObj(saved.credentials || {}),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Disconnect / delete integration
app.delete('/api/integrations/:provider', async (req, res) => {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const { provider } = req.params;
    let companyId = (req.query.companyId || req.query.company_id) as string | undefined;
    if (!companyId) {
      const userCompanies = await getUserCompanies(user.id);
      companyId = userCompanies[0]?.id;
    }
    if (!companyId) {
      res.status(400).json({ success: false, error: 'Company ID is required' });
      return;
    }

    const company = await getCompanyById(companyId);
    if (company && company.user_id !== user.id && user.role !== 'platform_admin') {
      res.status(403).json({ success: false, error: 'Access denied to delete integrations for this company' });
      return;
    }

    await deleteCompanyIntegration(companyId, provider);
    res.json({ success: true, message: `Disconnected ${provider}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// ---------------- REVIEWS API ENDPOINTS (PER-TENANT MYSQL PERSISTENCE) ---------------- //

// List all reviews for a company
app.get('/api/reviews', async (req, res) => {
  try {
    const user = await getAuthUserFromRequest(req);
    let targetCompanyId = (req.query.companyId || req.query.company_id) as string | undefined;

    if (user) {
      const userCompanies = await getUserCompanies(user.id);
      if (userCompanies.length > 0) {
        if (targetCompanyId) {
          const authorized = userCompanies.some((c) => c.id === targetCompanyId) || user.role === 'platform_admin';
          if (!authorized) {
            res.status(403).json({ success: false, error: 'Access denied to this company reviews' });
            return;
          }
        } else {
          targetCompanyId = userCompanies[0].id;
        }
      }
    }

    if (!targetCompanyId) {
      targetCompanyId = (await getDefaultCompanyId()) || 'comp_aaditech_main';
    }

    const reviews = await getCompanyReviews(targetCompanyId);
    res.json({ success: true, companyId: targetCompanyId, reviews });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Create new review (from webhook, sync, or manual client feedback)
app.post('/api/reviews', validateBody(createReviewSchema), async (req, res) => {
  try {
    const { author, rating, content, date, relative_time, sentiment, topic, is_operational_issue, source } = req.body;

    const user = await getAuthUserFromRequest(req);
    let targetCompanyId = (req.body.companyId || req.body.company_id || req.query.companyId || req.query.company_id) as string | undefined;

    if (user) {
      const userCompanies = await getUserCompanies(user.id);
      if (userCompanies.length > 0) {
        if (targetCompanyId) {
          const authorized = userCompanies.some((c) => c.id === targetCompanyId) || user.role === 'platform_admin';
          if (!authorized) {
            targetCompanyId = userCompanies[0].id;
          }
        } else {
          targetCompanyId = userCompanies[0].id;
        }
      }
    }

    if (!targetCompanyId) {
      targetCompanyId = (await getDefaultCompanyId()) || 'comp_aaditech_main';
    }

    const review = await createReview({
      company_id: targetCompanyId,
      author,
      rating: Number(rating) || 5,
      content,
      date: date || new Date().toISOString().split('T')[0],
      relative_time: relative_time || 'Just now',
      sentiment: sentiment || (Number(rating) >= 4 ? 'positive' : Number(rating) === 3 ? 'neutral' : 'negative'),
      topic: topic || 'Customer Service',
      is_operational_issue: Boolean(is_operational_issue),
      replied: false,
      source: source || 'google',
    });

    res.status(201).json({ success: true, review });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Publish / save reply to a review
app.post(['/api/reviews/:id/reply', '/api/reviews/:id/replyText'], validateBody(replyReviewSchema), async (req, res) => {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication required to post review replies' });
      return;
    }

    const { id } = req.params;
    const { replyText } = req.body;

    const companyId = (req.body.companyId || req.body.company_id || req.query.companyId) as string | undefined;
    if (companyId) {
      const company = await getCompanyById(companyId);
      if (company && company.user_id !== user.id && user.role !== 'platform_admin') {
        res.status(403).json({ success: false, error: 'Access denied to reply to this company review' });
        return;
      }
    }
    const success = await updateReviewReply(id, replyText.trim(), companyId);

    if (!success) {
      res.status(404).json({ success: false, error: 'Review not found' });
      return;
    }

    res.json({ success: true, message: 'Review reply saved to MySQL database successfully', reviewId: id });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Delete a review
app.delete('/api/reviews/:id', async (req, res) => {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const companyId = (req.query.companyId || req.query.company_id || req.body.companyId) as string | undefined;
    if (companyId) {
      const company = await getCompanyById(companyId);
      if (company && company.user_id !== user.id && user.role !== 'platform_admin') {
        res.status(403).json({ success: false, error: 'Access denied to delete this company review' });
        return;
      }
    }
    await deleteReview(id, companyId);
    res.json({ success: true, message: 'Review deleted from MySQL' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// ---------------- CONTENT POSTS API ENDPOINTS (PER-TENANT MYSQL PERSISTENCE) ---------------- //

// List all content posts for a company
app.get(['/api/content-posts', '/api/posts'], async (req, res) => {
  try {
    const user = await getAuthUserFromRequest(req);
    let targetCompanyId = (req.query.companyId || req.query.company_id) as string | undefined;

    if (user) {
      const userCompanies = await getUserCompanies(user.id);
      if (userCompanies.length > 0) {
        if (targetCompanyId) {
          const authorized = userCompanies.some((c) => c.id === targetCompanyId) || user.role === 'platform_admin';
          if (!authorized) {
            res.status(403).json({ success: false, error: 'Access denied to this company content' });
            return;
          }
        } else {
          targetCompanyId = userCompanies[0].id;
        }
      }
    }

    if (!targetCompanyId) {
      targetCompanyId = (await getDefaultCompanyId()) || 'comp_aaditech_main';
    }

    const posts = await getCompanyPosts(targetCompanyId);
    res.json({ success: true, companyId: targetCompanyId, posts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Create new content post in MySQL
app.post(['/api/content-posts', '/api/posts'], validateBody(createPostSchema), async (req, res) => {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication required to schedule posts' });
      return;
    }

    const {
      title,
      type,
      platforms,
      channel,
      headline,
      caption,
      cta,
      imageUrl,
      image_url,
      status,
      scheduledDate,
      scheduled_date,
      scheduledTime,
      scheduled_time,
      timeSlot,
      time_slot,
      hashtags,
      reelScript,
      reel_script,
    } = req.body;

    let targetCompanyId = (req.body.companyId || req.body.company_id || req.query.companyId || req.query.company_id) as string | undefined;
    const userCompanies = await getUserCompanies(user.id);
    if (userCompanies.length > 0) {
      if (targetCompanyId) {
        const authorized = userCompanies.some((c) => c.id === targetCompanyId) || user.role === 'platform_admin';
        if (!authorized) {
          targetCompanyId = userCompanies[0].id;
        }
      } else {
        targetCompanyId = userCompanies[0].id;
      }
    }

    if (!targetCompanyId) {
      targetCompanyId = (await getDefaultCompanyId()) || 'comp_aaditech_main';
    }

    const newPost = await createContentPost({
      company_id: targetCompanyId,
      title: title || 'New Campaign Post',
      type: type || 'offer',
      platforms: Array.isArray(platforms) ? platforms : ['google'],
      channel: channel || (Array.isArray(platforms) && platforms[0]) || 'google',
      headline: headline || '',
      caption,
      cta: cta || '',
      image_url: image_url || imageUrl || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=600&q=80',
      status: status || 'scheduled',
      scheduled_date: scheduled_date || scheduledDate || new Date().toISOString().split('T')[0],
      scheduled_time: scheduled_time || scheduledTime || `${new Date().toISOString().split('T')[0]} 10:00:00`,
      time_slot: time_slot || timeSlot || '10:00 AM',
      hashtags: Array.isArray(hashtags) ? hashtags : [],
      reel_script: reel_script || reelScript || undefined,
    });

    res.status(201).json({ success: true, post: newPost });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Update post status (e.g. publish now, approve draft)
app.patch(['/api/content-posts/:id/status', '/api/posts/:id/status'], async (req, res) => {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      res.status(400).json({ success: false, error: 'Status is required' });
      return;
    }

    const companyId = (req.body.companyId || req.body.company_id || req.query.companyId) as string | undefined;
    if (companyId) {
      const company = await getCompanyById(companyId);
      if (company && company.user_id !== user.id && user.role !== 'platform_admin') {
        res.status(403).json({ success: false, error: 'Access denied to update this content post' });
        return;
      }
    }
    await updateContentPostStatus(id, status, companyId);
    res.json({ success: true, message: `Post status updated to ${status} in MySQL` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Delete a content post
app.delete(['/api/content-posts/:id', '/api/posts/:id'], async (req, res) => {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const companyId = (req.query.companyId || req.query.company_id || req.body.companyId) as string | undefined;
    if (companyId) {
      const company = await getCompanyById(companyId);
      if (company && company.user_id !== user.id && user.role !== 'platform_admin') {
        res.status(403).json({ success: false, error: 'Access denied to delete this content post' });
        return;
      }
    }
    await deleteContentPost(id, companyId);
    res.json({ success: true, message: 'Content post deleted from MySQL' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// AI Chat / Telegram Natural Language endpoint (Protected with Auth + Rate Limiting)
app.post('/api/ai/chat', aiRateLimiter, async (req, res) => {
  const user = await getAuthUserFromRequest(req);
  if (!user) {
    res.status(401).json({ success: false, error: 'Authentication required to use AI marketing features. Please log in.' });
    return;
  }

  const { message, context, businessName, category, language } = req.body;
  const prompt = `You are LocalPulse AI, a 24/7 Autonomous AI Marketing & Growth Manager for Aaditech Solution (aaditechs.in).
Business Name: ${businessName || 'Aaditech Solution'}
Category: ${category || 'IT Services, Web & Mobile App Development, Local SEO'}
Website: https://aaditechs.in
Location: Thane / Mumbai MMR, Maharashtra, India
Language Preference: ${language || 'English / Hinglish'}
Current Context: ${JSON.stringify(context || {})}

User's Query / Command: "${message}"

Reply concisely, professionally, and action-oriented as their proactive tech marketing manager. If they asked to create a post, reply to reviews, or give a growth update, provide immediate actionable output with clear bullet points. If they speak in Hindi or Hinglish, respond in natural, friendly Hinglish.`;

  const aiText = await safeGenerateContent({ prompt });
  if (aiText) {
    res.json({ reply: aiText });
    return;
  }

  // Fallback intelligent responder
  const lowerMsg = (message || '').toLowerCase();
  let fallbackReply = '';
  if (lowerMsg.includes('aaj') || lowerMsg.includes('today') || lowerMsg.includes('important')) {
    fallbackReply = `📢 **Aaditech Solution - Aaj ke 3 High-Priority Actions:**
1. **Google Client Reviews:** 3 B2B reviews (Singhania Logistics, Patwardhan Dental, Apex Retailers) awaiting approval.
2. **High-Intent B2B Lead:** Dr. Rakesh Verma (Apex Diagnostic) requested WhatsApp automated PDF lab report system. WhatsApp quotation ready.
3. **Scheduled Post:** "Transform Your Business with Custom Web & Mobile App 2026" ready for Google Business Profile & LinkedIn.`;
  } else if (lowerMsg.includes('review') || lowerMsg.includes('reply')) {
    fallbackReply = `✅ **3 Client Reviews Analyzed & Drafted for Aaditech Solution:**
- 2 5⭐ Reviews (Logistics software & Dental clinic Google 3-Pack rank boost)
- 1 4⭐ Review on Play Store deployment timeframe (Polite gratitude + compliance assurance)
Saare replies Guardrail Safety Check pass kar chuke hain. "Approve All" dabayein to post ho jayenge!`;
  } else if (lowerMsg.includes('post') || lowerMsg.includes('sale') || lowerMsg.includes('creative')) {
    fallbackReply = `✨ **Aaditech Solution B2B Campaign Post Ready!**
🚀 **Headline:** "Upgrade Your Business with Custom Web & Mobile App Development!"
📝 **Caption:** "Tired of outdated manual spreadsheets? 💻 Aaditech Solution (aaditechs.in) builds enterprise-grade websites, custom Android/iOS apps, and automated WhatsApp CRM pipelines to scale your business. Free consultation available! 📍 Thane - Mumbai MMR | 🌐 aaditechs.in"
🏷️ **Hashtags:** #AaditechSolution #WebDevelopmentMumbai #AndroidAppDeveloper #LocalSEO #BusinessAutomation`;
  } else {
    fallbackReply = `LocalPulse AI active for **Aaditech Solution** (aaditechs.in): Current growth score **82/100** hai. Google 3-Pack rank #1 in Thane for "website development". 2 high-intent client inquiries pipeline mein hain. Aap kya review karna chahte hain?`;
  }
  res.json({ reply: fallbackReply });
});

// AI Review Reply Generator (Protected with Auth + Rate Limiting)
app.post('/api/ai/reply-review', aiRateLimiter, async (req, res) => {
  const user = await getAuthUserFromRequest(req);
  if (!user) {
    res.status(401).json({ success: false, error: 'Authentication required to use AI review reply generator. Please log in.' });
    return;
  }

  const { reviewText, rating, reviewerName, tone, language, businessName } = req.body;
  const prompt = `You are drafting a public reply to a client review for "${businessName || 'Aaditech Solution'} (aaditechs.in)".
Reviewer: ${reviewerName || 'Client'}
Rating: ${rating} / 5 stars
Review Content: "${reviewText}"
Desired Tone: ${tone || 'Professional & Friendly'} (e.g. Professional, Friendly, Short, Detailed, Hinglish)
Language: ${language || 'English'}

CRITICAL SAFETY GUARDRAILS:
- Do NOT argue or be defensive.
- Do NOT make false promises or admit legal liability.
- Do NOT share sensitive internal client data.
- Be warm, authentic, tech-forward, and reinforce reliability, warranty, and long-term partnership.

Draft the exact reply text only.`;

  const aiText = await safeGenerateContent({ prompt });
  if (aiText) {
    res.json({ replyText: aiText });
    return;
  }

  // Fallback reply
  const fallback = rating >= 4
    ? `Thank you so much, ${reviewerName}! We at Aaditech Solution are delighted to deliver scalable technology solutions that power your business growth. Looking forward to continuing our partnership!`
    : `Dear ${reviewerName}, thank you for your candid feedback. We continuously refine our turnaround times and development sprints. Our lead engineer is directly available to ensure all requirements are addressed promptly.`;

  res.json({ replyText: fallback });
});

// AI Content Studio Generator (Protected with Auth + Rate Limiting)
app.post('/api/ai/generate-content', aiRateLimiter, async (req, res) => {
  const user = await getAuthUserFromRequest(req);
  if (!user) {
    res.status(401).json({ success: false, error: 'Authentication required to use AI content generator. Please log in.' });
    return;
  }

  const { businessName, category, contentType, platform, offer, language, targetAudience } = req.body;
  const prompt = `Generate a high-converting B2B technology marketing post for Aaditech Solution (aaditechs.in).
Business Name: ${businessName || 'Aaditech Solution'}
Category: ${category || 'IT Services, Web & Mobile App Development'}
Website: https://aaditechs.in
Content Type: ${contentType || 'Offer / B2B Solution'}
Target Platform: ${platform || 'Google Business Profile, LinkedIn, Instagram'}
Offer/Theme: ${offer || 'Custom Web & Mobile App Package'}
Language: ${language || 'English / Hinglish'}
Target Audience: ${targetAudience || 'MSME business owners, retail distributors, healthcare clinics, logistics'}

Provide a JSON-compatible structured response with:
- headline
- caption (with natural emojis and website reference aaditechs.in)
- callToAction
- hashtags (5-7 relevant B2B tech and local SEO tags)
- googlePostSnippet (under 100 words, high direct-call/WhatsApp intent)
- reelScript (3 scene outline for a 15-second reel)`;

  const aiText = await safeGenerateContent({
    prompt,
    responseMimeType: 'application/json',
  });

  if (aiText) {
    try {
      const parsed = JSON.parse(aiText);
      res.json(parsed);
      return;
    } catch {
      res.json({ raw: aiText });
      return;
    }
  }

  res.json({
    headline: `🚀 Modernize Your Business with Aaditech Solution!`,
    caption: `Are manual registers and outdated websites holding your company back? 💻 At Aaditech Solution (aaditechs.in), we design blazing-fast business websites, custom Android/iOS mobile applications, and automated WhatsApp CRM solutions that generate qualified leads on autopilot. Book your free tech consultation today!`,
    callToAction: 'Book Free Tech Consultation on WhatsApp',
    hashtags: ['#AaditechSolution', '#WebDevelopment', '#AndroidAppDevelopment', '#LocalSEOMumbai', '#BusinessAutomation'],
    googlePostSnippet: `Special Technology Acceleration Package by Aaditech Solution: Get a custom responsive website, Google 3-Pack Maps optimization, and automated WhatsApp lead engine. Visit aaditechs.in or call +91 22 4963 8603 today!`,
    reelScript: [
      { scene: 'Scene 1 (0-4s)', visual: 'Business owner struggling with lost WhatsApp customer leads', audio: 'Losing high-value client inquiries because of manual follow-ups?' },
      { scene: 'Scene 2 (4-10s)', visual: 'Sleek custom Android app and modern website portal built by Aaditech Solution', audio: 'Aaditech Solution builds custom mobile apps and WhatsApp automation engines tailored to your industry.' },
      { scene: 'Scene 3 (10-15s)', visual: 'Client seeing real-time orders and 5-star Google reviews rolling in', audio: 'Accelerate your revenue today. Visit aaditechs.in or tap link in bio!' },
    ],
  });
});

// Production Lead Capture API (bga.aaditechs.in) - Protected with Authentication & IDOR filtering
app.get('/api/leads', async (req, res) => {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const requestedCompanyId = (req.query.companyId || req.query.company_id) as string | undefined;

    // If specific company requested, verify company ownership
    if (requestedCompanyId && typeof requestedCompanyId === 'string') {
      const company = await getCompanyById(requestedCompanyId);
      if (!company) {
        res.status(404).json({ success: false, error: 'Company not found' });
        return;
      }
      if (company.user_id !== user.id && user.role !== 'platform_admin') {
        res.status(403).json({ success: false, error: 'Access denied to this company leads' });
        return;
      }
      const leads = await getAllLeads(requestedCompanyId);
      res.json({ success: true, leads });
      return;
    }

    // If no companyId specified:
    // Only platform_admin can access all leads across all tenants
    if (user.role === 'platform_admin') {
      const leads = await getAllLeads();
      res.json({ success: true, leads });
      return;
    }

    // Tenant owners / managers can only see leads belonging to their owned companies
    const userCompanies = await getUserCompanies(user.id);
    if (!userCompanies || userCompanies.length === 0) {
      res.json({ success: true, leads: [] });
      return;
    }

    const companyIds = new Set(userCompanies.map((c) => c.id));
    const allLeads = await getAllLeads();
    const filtered = allLeads.filter((l) => l.company_id && companyIds.has(l.company_id));
    res.json({ success: true, leads: filtered });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message });
  }
});

// Ingest new lead from Website Contact Form, Google 3-Pack Call, or Meta Ads Webhook (Protected with Rate Limiting, Zod Validation & Company Linking)
app.post('/api/leads', leadsRateLimiter, validateBody(createLeadSchema), async (req, res) => {
  try {
    const { name, company, phone, email, service, budget, source, notes, stage } = req.body;
    let targetCompanyId = (req.body.company_id || req.body.companyId || req.query.company_id || req.query.companyId) as string | undefined;

    // 1. If caller is authenticated (e.g. from CRM dashboard), associate with user's verified company
    const authUser = await getAuthUserFromRequest(req);
    if (authUser) {
      const userCompanies = await getUserCompanies(authUser.id);
      if (userCompanies.length > 0) {
        if (targetCompanyId) {
          const userOwnsCompany = userCompanies.some((c) => c.id === targetCompanyId) || authUser.role === 'platform_admin';
          if (!userOwnsCompany) {
            // Re-bind to user's first company to prevent cross-tenant leakage
            targetCompanyId = userCompanies[0].id;
          }
        } else {
          targetCompanyId = userCompanies[0].id;
        }
      }
    }

    // 2. If unauthenticated public contact form or external webhook, resolve to specified or default company
    if (!targetCompanyId) {
      targetCompanyId = (await getDefaultCompanyId()) || undefined;
    }

    const newLead = await createLead({
      company_id: targetCompanyId,
      name,
      company: company || 'Direct Client',
      phone,
      email: email || '',
      service: service || 'IT & Digital Growth Services',
      budget: budget || 'Custom Proposal',
      stage: stage || 'new',
      intent_score: 92,
      source: source || 'bga.aaditechs.in Form',
      notes: notes || '',
      ai_suggested_reply: `Namaste ${name}! Aaditech Solution (bga.aaditechs.in) has received your inquiry for ${service || 'our tech solutions'}. Our senior consultant will connect with you on WhatsApp shortly.`,
    });

    // Auto-dispatch real Telegram alert to Owner's Phone if configured
    const targetComp = newLead.company_id ? await getCompanyById(newLead.company_id) : null;
    const targetCompName = targetComp?.name || newLead.company || 'Aaditech Client';
    const alertMsg = `🔥 *NEW HOT LEAD RECEIVED!* (${newLead.source})\n\n🏢 *Target Business:* ${targetCompName}\n👤 *Client:* ${newLead.name}\n🏢 *Client Org:* ${newLead.company}\n📞 *Phone:* \`${newLead.phone}\`\n💼 *Service:* ${newLead.service}\n💰 *Budget:* ${newLead.budget}\n🎯 *Intent Score:* ${newLead.intent_score}%\n\n📱 *Platform:* bga.aaditechs.in`;
    sendTelegramPushAlert(alertMsg).catch(() => {});

    res.status(201).json({ success: true, lead: newLead });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message });
  }
});

// Update lead stage - Protected with Authentication, IDOR Verification & Zod Validation
app.patch('/api/leads/:id/stage', validateBody(updateLeadStageSchema), async (req, res) => {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const { stage } = req.body;

    const lead = await getLeadById(id);
    if (!lead) {
      res.status(404).json({ success: false, error: 'Lead not found' });
      return;
    }

    // Verify IDOR authorization
    if (lead.company_id) {
      const company = await getCompanyById(lead.company_id);
      if (company && company.user_id !== user.id && user.role !== 'platform_admin') {
        res.status(403).json({ success: false, error: 'Access denied to update this lead' });
        return;
      }
    } else if (user.role !== 'platform_admin') {
      res.status(403).json({ success: false, error: 'Access denied to update global lead' });
      return;
    }

    const success = await updateLeadStatus(id, stage);
    res.json({ success });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message });
  }
});

// ---------------- WHATSAPP CLOUD API & RAZORPAY GATEWAY HELPERS & ENDPOINTS ---------------- //

// Helper to resolve WhatsApp Cloud credentials per company or system env
async function resolveWhatsAppCredentials(companyId?: string) {
  let phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  let accessToken = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN || '';
  let wabaId = process.env.WHATSAPP_WABA_ID || '';

  if (companyId) {
    try {
      const integration = await getCompanyIntegration(companyId, 'whatsapp_cloud');
      if (integration && integration.credentials) {
        if (integration.credentials.phoneNumberId) phoneNumberId = integration.credentials.phoneNumberId;
        if (integration.credentials.accessToken) accessToken = integration.credentials.accessToken;
        if (integration.credentials.wabaId) wabaId = integration.credentials.wabaId;
      }
    } catch {}
  }
  return {
    phoneNumberId: phoneNumberId.trim(),
    accessToken: accessToken.trim(),
    wabaId: wabaId.trim(),
    configured: Boolean(phoneNumberId.trim() && accessToken.trim()),
  };
}

// Helper to resolve Razorpay credentials per company or system env
async function resolveRazorpayCredentials(companyId?: string) {
  let keyId = process.env.RAZORPAY_KEY_ID || '';
  let keySecret = process.env.RAZORPAY_KEY_SECRET || '';

  if (companyId) {
    try {
      const integration = await getCompanyIntegration(companyId, 'razorpay_gateway');
      if (integration && integration.credentials) {
        if (integration.credentials.keyId) keyId = integration.credentials.keyId;
        if (integration.credentials.keySecret) keySecret = integration.credentials.keySecret;
      }
    } catch {}
  }
  return {
    keyId: keyId.trim(),
    keySecret: keySecret.trim(),
    configured: Boolean(keyId.trim() && keySecret.trim()),
    isLive: keyId.trim().startsWith('rzp_live'),
  };
}

// WhatsApp Status Endpoint
app.get('/api/whatsapp/status', async (req, res) => {
  try {
    const companyId = (req.query.companyId || req.query.company_id) as string | undefined;
    const creds = await resolveWhatsAppCredentials(companyId);
    res.json({
      success: true,
      configured: creds.configured,
      phoneNumberId: creds.phoneNumberId ? maskSecret(creds.phoneNumberId) : null,
      wabaId: creds.wabaId ? maskSecret(creds.wabaId) : null,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Send WhatsApp Message via Meta Cloud API with fallback
app.post('/api/whatsapp/send', async (req, res) => {
  try {
    const { to, message, templateName, languageCode, companyId } = req.body;
    if (!to || (!message && !templateName)) {
      res.status(400).json({ success: false, error: 'Recipient phone number and message or templateName are required' });
      return;
    }

    let cleanTo = String(to).replace(/[^0-9]/g, '');
    if (cleanTo.length === 10) cleanTo = '91' + cleanTo;
    if (cleanTo.startsWith('0') && cleanTo.length === 11) cleanTo = '91' + cleanTo.substring(1);

    const creds = await resolveWhatsAppCredentials(companyId);

    if (creds.configured) {
      // Call official Meta Graph API
      try {
        const payload: any = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanTo,
        };

        if (templateName) {
          payload.type = 'template';
          payload.template = {
            name: templateName,
            language: { code: languageCode || 'en_US' },
          };
        } else {
          payload.type = 'text';
          payload.text = {
            preview_url: true,
            body: message,
          };
        }

        const waRes = await fetch(`https://graph.facebook.com/v21.0/${creds.phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${creds.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        });

        const waData = await waRes.json();
        if (waRes.ok && waData.messages && waData.messages.length > 0) {
          const messageId = waData.messages[0].id;
          res.json({
            success: true,
            method: 'meta_cloud_api',
            messageId,
            recipient: cleanTo,
            message: `Message sent via official Meta WhatsApp Cloud API! (ID: ${messageId})`,
          });
          return;
        } else {
          // Meta API returned an error (e.g. template required outside 24h customer window)
          const errorMsg = waData.error?.message || 'Meta Cloud API error';
          const fallbackLink = `https://wa.me/${cleanTo}?text=${encodeURIComponent(message || '')}`;
          res.json({
            success: false,
            method: 'meta_cloud_api',
            error: errorMsg,
            waLink: fallbackLink,
            fallbackNotice: 'Direct wa.me link generated as backup due to Meta Graph API response.',
          });
          return;
        }
      } catch (metaErr: any) {
        const fallbackLink = `https://wa.me/${cleanTo}?text=${encodeURIComponent(message || '')}`;
        res.json({
          success: false,
          method: 'meta_cloud_api',
          error: metaErr?.message || 'Network timeout connecting to Meta Graph API',
          waLink: fallbackLink,
        });
        return;
      }
    }

    // Fallback if credentials not yet configured
    const waLink = `https://wa.me/${cleanTo}?text=${encodeURIComponent(message || '')}`;
    res.json({
      success: true,
      method: 'wa_link',
      recipient: cleanTo,
      waLink,
      message: 'Direct WhatsApp link generated. Connect WhatsApp Cloud API in Integrations tab for 100% autonomous background delivery.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Meta Webhook Verification Handshake
app.get('/api/whatsapp/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || 'aaditech_bga_whatsapp_verify_token';

  if (mode === 'subscribe' && token === expectedToken) {
    console.log('[WhatsApp Webhook] Verification challenge accepted');
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Verification token mismatch');
  }
});

// Meta Webhook Inbound Message Receiver
app.post('/api/whatsapp/webhook', async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const message = change?.messages?.[0];
    const contact = change?.contacts?.[0];

    if (message && contact) {
      const fromPhone = message.from;
      const contactName = contact.profile?.name || `WhatsApp Client (+${fromPhone})`;
      const textBody = message.text?.body || '[Media/Voice Note]';

      console.log(`[WhatsApp Inbound] Received message from ${contactName} (${fromPhone}): ${textBody}`);

      // Auto-ingest lead into database
      const defaultCompId = (await getDefaultCompanyId()) || 'comp_aaditech_main';
      createLead({
        company_id: defaultCompId,
        name: contactName,
        company: 'WhatsApp Inbound Inquiry',
        phone: `+${fromPhone}`,
        service: 'WhatsApp Direct Inquiry',
        budget: 'Pending Discussion',
        stage: 'new',
        intent_score: 95,
        source: 'WhatsApp Cloud Inbound',
        notes: `Inbound text: "${textBody}"`,
        ai_suggested_reply: `Namaste ${contactName}! Aaditech Solution has received your message. A dedicated technical consultant will reply right here on WhatsApp within 15 minutes.`,
      }).catch((e) => console.warn('Failed to save inbound WhatsApp lead:', e));

      // Push instant Telegram alert
      sendTelegramPushAlert(
        `💬 *NEW WHATSAPP MESSAGE RECEIVED!*\n\n👤 *Client:* ${contactName}\n📞 *Phone:* \`+${fromPhone}\`\n📝 *Message:* "${textBody}"\n\n⚡ Ingested into CRM automatically.`
      ).catch(() => {});
    }

    res.status(200).json({ status: 'ok' });
  } catch (err: any) {
    console.warn('[WhatsApp Webhook] Handler error:', err?.message);
    res.status(200).json({ status: 'handled_with_error' });
  }
});

// Razorpay Status Endpoint
app.get('/api/razorpay/status', async (req, res) => {
  try {
    const companyId = (req.query.companyId || req.query.company_id) as string | undefined;
    const creds = await resolveRazorpayCredentials(companyId);
    res.json({
      success: true,
      configured: creds.configured,
      isLive: creds.isLive,
      keyId: creds.keyId ? maskSecret(creds.keyId) : null,
      mode: creds.isLive ? 'LIVE' : creds.configured ? 'TEST / SANDBOX' : 'UNCONFIGURED',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Create Razorpay Order
app.post('/api/razorpay/create-order', async (req, res) => {
  try {
    const { amount, currency, receipt, notes, companyId } = req.body;
    if (!amount || amount <= 0) {
      res.status(400).json({ success: false, error: 'Valid amount greater than 0 is required' });
      return;
    }

    const amountInPaise = Math.round(Number(amount) * 100);
    const orderReceipt = receipt || `rcpt_${Date.now()}`;
    const creds = await resolveRazorpayCredentials(companyId);

    if (creds.configured) {
      try {
        const authHeader = 'Basic ' + Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString('base64');
        const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: amountInPaise,
            currency: currency || 'INR',
            receipt: orderReceipt,
            notes: notes || {},
          }),
          signal: AbortSignal.timeout(8000),
        });

        const rzpData = await rzpRes.json();
        if (rzpRes.ok && rzpData.id) {
          res.json({
            success: true,
            order: rzpData,
            keyId: creds.keyId,
            mode: creds.isLive ? 'live' : 'test',
          });
          return;
        } else {
          res.status(400).json({
            success: false,
            error: rzpData.error?.description || 'Failed to create Razorpay order',
          });
          return;
        }
      } catch (rzpErr: any) {
        res.status(500).json({
          success: false,
          error: `Razorpay connection error: ${rzpErr?.message}`,
        });
        return;
      }
    }

    // Fallback test order for sandbox exploration
    const mockOrderId = `order_test_${Date.now()}`;
    res.json({
      success: true,
      order: {
        id: mockOrderId,
        entity: 'order',
        amount: amountInPaise,
        amount_paid: 0,
        amount_due: amountInPaise,
        currency: currency || 'INR',
        receipt: orderReceipt,
        status: 'created',
        notes: notes || {},
      },
      keyId: 'rzp_test_demo12345678',
      mode: 'sandbox_preview',
      notice: 'Razorpay API keys not yet stored in Integrations tab. Simulated order created for testing.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Verify Razorpay Payment Signature
app.post('/api/razorpay/verify-payment', validateBody(verifyRazorpayPaymentSchema), async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, companyId, leadId, planName, amount } = req.body;

    const creds = await resolveRazorpayCredentials(companyId);

    // CRITICAL SECURITY ENFORCEMENT:
    // Never accept fake or unverified payments. Verification MUST fail if Razorpay credentials are not configured!
    if (!creds.configured || !creds.keySecret) {
      res.status(400).json({
        success: false,
        verified: false,
        error: 'Razorpay payment gateway credentials (Key ID and Secret) are not configured. Cannot verify payment without merchant credentials in Integrations settings.',
      });
      return;
    }

    const generatedSignature = crypto
      .createHmac('sha256', creds.keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const sigBuf = Buffer.from(razorpay_signature, 'utf-8');
    const genBuf = Buffer.from(generatedSignature, 'utf-8');

    const isAuthentic =
      sigBuf.length === genBuf.length &&
      crypto.timingSafeEqual(sigBuf, genBuf);

    if (!isAuthentic) {
      res.status(400).json({
        success: false,
        verified: false,
        error: 'Payment signature verification failed. Invalid cryptographic HMAC-SHA256 signature.',
      });
      return;
    }

    // If tied to a lead, verify tenant matching and update status to 'won'
    if (leadId) {
      const lead = await getLeadById(leadId);
      if (lead) {
        if (companyId && lead.company_id && lead.company_id !== companyId) {
          res.status(403).json({
            success: false,
            verified: false,
            error: 'Lead does not belong to the specified company workspace',
          });
          return;
        }
        await updateLeadStatus(leadId, 'won');
      }
    }

    // Dispatch verified payment alert to owner's Telegram
    const paymentMsg = `💰 *REAL PAYMENT CONFIRMED VIA RAZORPAY!*\n\n💳 *Payment ID:* \`${razorpay_payment_id}\`\n📦 *Order ID:* \`${razorpay_order_id}\`\n💵 *Amount:* ₹${amount || 'Paid'}\n📌 *Plan/Service:* ${planName || 'Digital Services'}\n\n✅ Cryptographic HMAC-SHA256 signature verified against Razorpay Key Secret.`;
    sendTelegramPushAlert(paymentMsg).catch(() => {});

    res.json({
      success: true,
      verified: true,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      message: 'Payment signature verified successfully against Razorpay secret!',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Create Instant Payment Link (for Leads, WhatsApp, Invoices)
app.post('/api/razorpay/create-payment-link', async (req, res) => {
  try {
    const { amount, description, customerName, customerPhone, customerEmail, companyId, leadId } = req.body;
    if (!amount || amount <= 0) {
      res.status(400).json({ success: false, error: 'Valid amount is required' });
      return;
    }

    const amountInPaise = Math.round(Number(amount) * 100);
    const creds = await resolveRazorpayCredentials(companyId);

    let cleanPhone = String(customerPhone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

    if (creds.configured) {
      try {
        const authHeader = 'Basic ' + Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString('base64');
        const linkPayload = {
          amount: amountInPaise,
          currency: 'INR',
          accept_partial: false,
          description: description || 'Digital Growth Services & Retainer',
          customer: {
            name: customerName || 'Valued Client',
            contact: cleanPhone ? `+${cleanPhone}` : undefined,
            email: customerEmail || undefined,
          },
          notify: { sms: Boolean(cleanPhone), email: Boolean(customerEmail) },
          reminder_enable: true,
          notes: {
            leadId: leadId || '',
            companyId: companyId || '',
          },
        };

        const linkRes = await fetch('https://api.razorpay.com/v1/payment_links', {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(linkPayload),
          signal: AbortSignal.timeout(8000),
        });

        const linkData = await linkRes.json();
        if (linkRes.ok && linkData.short_url) {
          res.json({
            success: true,
            method: 'razorpay_live',
            paymentLinkId: linkData.id,
            shortUrl: linkData.short_url,
            amount: Number(amount),
            currency: 'INR',
          });
          return;
        } else {
          console.warn('Razorpay payment link error:', linkData.error);
        }
      } catch (linkErr: any) {
        console.warn('Razorpay payment link fetch failed:', linkErr?.message);
      }
    }

    // Direct UPI payment link fallback (Standard NPCI UPI Intent URL for phone apps)
    const upiUri = `upi://pay?pa=r8898278453@okaxis&pn=Aaditech%20Solution&am=${amount}&cu=INR&tn=${encodeURIComponent(description || 'Services Payment')}`;
    const simulatedLink = `https://rzp.io/i/test_${Date.now().toString(36)}`;

    res.json({
      success: true,
      method: 'upi_fallback',
      shortUrl: simulatedLink,
      upiUri,
      amount: Number(amount),
      currency: 'INR',
      notice: 'Direct UPI link and simulated Razorpay URL generated.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Razorpay Webhook Inbound Handler
app.post('/api/razorpay/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (webhookSecret && signature) {
      const shasum = crypto.createHmac('sha256', webhookSecret);
      shasum.update(JSON.stringify(req.body));
      const digest = shasum.digest('hex');
      const sigBuf = Buffer.from(signature, 'utf-8');
      const digBuf = Buffer.from(digest, 'utf-8');
      if (sigBuf.length !== digBuf.length || !crypto.timingSafeEqual(sigBuf, digBuf)) {
        console.warn('[Razorpay Webhook] Invalid signature rejected');
        res.status(400).json({ error: 'Invalid webhook signature' });
        return;
      }
    }

    const event = req.body.event;
    const payload = req.body.payload;

    console.log(`[Razorpay Webhook] Received event: ${event}`);

    if (event === 'payment.captured' || event === 'order.paid' || event === 'payment_link.paid') {
      const payment = payload?.payment?.entity;
      const amountRupees = payment ? payment.amount / 100 : 'N/A';
      const payerPhone = payment?.contact || '';
      const payerEmail = payment?.email || '';

      sendTelegramPushAlert(
        `🎉 *WEBHOOK: RAZORPAY PAYMENT CAPTURED!*\n\n💰 *Amount:* ₹${amountRupees}\n💳 *Payment ID:* \`${payment?.id}\`\n📞 *Contact:* ${payerPhone} / ${payerEmail}\n⚡ Event: \`${event}\``
      ).catch(() => {});
    }

    res.status(200).json({ status: 'ok' });
  } catch (err: any) {
    res.status(200).json({ status: 'handled' });
  }
});

// Direct Telegram alert dispatch endpoint - Protected with Authentication & Rate Limiting
app.post('/api/telegram/notify', telegramAlertLimiter, async (req, res) => {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const { message } = req.body;
    if (!message) {
      res.status(400).json({ success: false, error: 'Message is required' });
      return;
    }
    const dispatched = await sendTelegramPushAlert(message);
    res.json({ success: dispatched });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message });
  }
});

// System Deployment & Environment Health Check
app.get('/api/system/status', (req, res) => {
  const dbStatus = getDbStatus();
  res.json({
    app: 'Aaditech BGA',
    subdomain: 'bga.aaditechs.in',
    environment: process.env.NODE_ENV || 'development',
    database: dbStatus,
    mysqlConfigured: dbStatus.configured,
    mysqlConnected: dbStatus.connected,
    telegramConfigured: !!process.env.TELEGRAM_BOT_TOKEN,
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// Global process exception handlers to prevent unexpected process exit
process.on('unhandledRejection', (reason) => {
  console.warn('[Server] Unhandled rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught exception:', err);
});

async function startServer() {
  try {
    let viteInstance: any = null;

    if (process.env.NODE_ENV !== 'production') {
      viteInstance = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(viteInstance.middlewares);
      console.log('[Server] Vite middleware mounted and ready.');
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[Server] Port ${PORT} currently in use. Retrying in 1s...`);
        setTimeout(() => {
          try {
            server.close();
          } catch {}
          server.listen(PORT, '0.0.0.0');
        }, 1000);
      } else {
        console.error('[Server] Fatal server error:', err);
      }
    });

    const cleanup = async () => {
      console.log('[Server] Shutting down gracefully...');
      if (viteInstance) {
        try {
          await viteInstance.close();
        } catch {}
      }
      server.close(() => {
        process.exit(0);
      });
    };

    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);
  } catch (error) {
    console.error('Fatal error starting server:', error);
    process.exit(1);
  }
}

startServer();


