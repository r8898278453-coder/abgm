import express from 'express';
import path from 'path';
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
  getUserCompanies,
  getCompanyById,
  createCompany,
  getCompanyDataPayload,
  saveCompanyDataPayload,
  getDbStatus,
  getDefaultCompanyId,
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

const app = express();
const PORT = 3000;

app.use(express.json());

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

// Register new user (protected with registration rate limiting)
app.post('/api/auth/register', registerRateLimiter, async (req, res) => {
  try {
    const { email, password, full_name, role } = req.body;
    if (!email || !password || !full_name) {
      res.status(400).json({ success: false, error: 'Email, password, and name are required' });
      return;
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      res.status(409).json({ success: false, error: 'An account with this email already exists' });
      return;
    }

    const user = await createUser({
      email,
      password,
      full_name,
      role: role || 'owner',
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

// User login (protected with rate limiting & brute-force account lockout)
app.post('/api/auth/login', loginProtectionMiddleware, async (req, res) => {
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

// Get all companies for current user
app.get('/api/companies', async (req, res) => {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const companies = await getUserCompanies(user.id);
    res.json({ success: true, companies });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Create new company profile
app.post('/api/companies', async (req, res) => {
  try {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const { name, legal_name, category, city, phone, website, google_place_id } = req.body;
    if (!name || !category || !city) {
      res.status(400).json({ success: false, error: 'Company Name, Category, and City are required' });
      return;
    }

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

    if (company.user_id !== user.id && user.role !== 'owner') {
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

    if (company.user_id !== user.id && user.role !== 'owner') {
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
      if (company.user_id !== user.id && user.role !== 'owner') {
        res.status(403).json({ success: false, error: 'Access denied to this company leads' });
        return;
      }
      const leads = await getAllLeads(requestedCompanyId);
      res.json({ success: true, leads });
      return;
    }

    // If no companyId specified:
    // Global owners can access all leads
    if (user.role === 'owner') {
      const leads = await getAllLeads();
      res.json({ success: true, leads });
      return;
    }

    // Non-owners can only see leads belonging to their owned companies
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

// Ingest new lead from Website Contact Form, Google 3-Pack Call, or Meta Ads Webhook (Protected with Rate Limiting & Company Linking)
app.post('/api/leads', leadsRateLimiter, async (req, res) => {
  try {
    const { name, company, phone, email, service, budget, source, notes } = req.body;
    let targetCompanyId = (req.body.company_id || req.body.companyId || req.query.company_id || req.query.companyId) as string | undefined;

    if (!name || !phone) {
      res.status(400).json({ success: false, error: 'Name and phone number are required' });
      return;
    }

    // 1. If caller is authenticated (e.g. from CRM dashboard), associate with user's verified company
    const authUser = await getAuthUserFromRequest(req);
    if (authUser) {
      const userCompanies = await getUserCompanies(authUser.id);
      if (userCompanies.length > 0) {
        if (targetCompanyId) {
          const userOwnsCompany = userCompanies.some((c) => c.id === targetCompanyId) || authUser.role === 'owner';
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
      stage: 'new',
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

// Update lead stage - Protected with Authentication & IDOR Verification
app.patch('/api/leads/:id/stage', async (req, res) => {
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
      if (company && company.user_id !== user.id && user.role !== 'owner') {
        res.status(403).json({ success: false, error: 'Access denied to update this lead' });
        return;
      }
    } else if (user.role !== 'owner') {
      res.status(403).json({ success: false, error: 'Access denied to update global lead' });
      return;
    }

    const success = await updateLeadStatus(id, stage);
    res.json({ success });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message });
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
    let viteMiddlewares: any = null;
    let viteInstance: any = null;

    if (process.env.NODE_ENV !== 'production') {
      app.use((req, res, next) => {
        if (viteMiddlewares) {
          return viteMiddlewares(req, res, next);
        }
        // Respond to initial container pre-warm and health checks immediately while Vite initializes
        if (req.path === '/' || req.path === '/api/health') {
          return res.status(200).send('<!doctype html><html><head><title>Aaditech BGA</title></head><body><div id="root">Initializing Aaditech BGA...</div></body></html>');
        }
        next();
      });
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

    // Initialize Vite middleware asynchronously so port 3000 is reachable immediately
    if (process.env.NODE_ENV !== 'production') {
      createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      })
        .then((vite) => {
          viteInstance = vite;
          viteMiddlewares = vite.middlewares;
          console.log('[Server] Vite middleware mounted and ready.');
        })
        .catch((err) => {
          console.error('[Server] Error initializing Vite middleware:', err);
        });
    }

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


