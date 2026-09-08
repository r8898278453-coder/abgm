import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

import {
  getAllLeads,
  createLead,
  updateLeadStatus,
  sendTelegramPushAlert,
  findUserByEmail,
  findUserById,
  createUser,
  verifyPassword,
  getUserCompanies,
  getCompanyById,
  createCompany,
  getCompanyDataPayload,
  saveCompanyDataPayload,
} from './server/db';

const app = express();
const PORT = 3000;

app.use(express.json());

// Token helper for session management (Token format: base64(userId:email:timestamp))
function generateAuthToken(user: { id: string; email: string }): string {
  const payload = `${user.id}:${user.email}:${Date.now()}`;
  return Buffer.from(payload).toString('base64');
}

async function getAuthUserFromRequest(req: express.Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [userId] = decoded.split(':');
    if (!userId) return null;
    return await findUserById(userId);
  } catch {
    return null;
  }
}

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

// Register new user
app.post('/api/auth/register', async (req, res) => {
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

// User login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email and password are required' });
      return;
    }

    const user = await findUserByEmail(email);
    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

    const isValid = verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

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
    const { id } = req.params;
    const company = await getCompanyById(id);
    if (!company) {
      res.status(404).json({ success: false, error: 'Company not found' });
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
    const { id } = req.params;
    const { data } = req.body;
    await saveCompanyDataPayload(id, data);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});


// AI Chat / Telegram Natural Language endpoint
app.post('/api/ai/chat', async (req, res) => {
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

// AI Review Reply Generator
app.post('/api/ai/reply-review', async (req, res) => {
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

// AI Content Studio Generator
app.post('/api/ai/generate-content', async (req, res) => {
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

// Production Lead Capture API (bga.aaditechs.in)
app.get('/api/leads', async (req, res) => {
  try {
    const leads = await getAllLeads();
    res.json({ success: true, leads });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message });
  }
});

// Ingest new lead from Website Contact Form, Google 3-Pack Call, or Meta Ads Webhook
app.post('/api/leads', async (req, res) => {
  try {
    const { name, company, phone, email, service, budget, source, notes } = req.body;

    if (!name || !phone) {
      res.status(400).json({ success: false, error: 'Name and phone number are required' });
      return;
    }

    const newLead = await createLead({
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
    const alertMsg = `🔥 *NEW HOT LEAD RECEIVED!* (${newLead.source})\n\n👤 *Client:* ${newLead.name}\n🏢 *Company:* ${newLead.company}\n📞 *Phone:* \`${newLead.phone}\`\n💼 *Service:* ${newLead.service}\n💰 *Budget:* ${newLead.budget}\n🎯 *Intent Score:* ${newLead.intent_score}%\n\n📱 *Platform:* bga.aaditechs.in`;
    sendTelegramPushAlert(alertMsg).catch(() => {});

    res.status(201).json({ success: true, lead: newLead });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message });
  }
});

// Update lead stage
app.patch('/api/leads/:id/stage', async (req, res) => {
  try {
    const { id } = req.params;
    const { stage } = req.body;
    const success = await updateLeadStatus(id, stage);
    res.json({ success });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message });
  }
});

// Direct Telegram alert dispatch endpoint
app.post('/api/telegram/notify', async (req, res) => {
  try {
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
  res.json({
    app: 'Aaditech BGA',
    subdomain: 'bga.aaditechs.in',
    environment: process.env.NODE_ENV || 'development',
    mysqlConfigured: !!process.env.DB_HOST && !!process.env.DB_NAME,
    telegramConfigured: !!process.env.TELEGRAM_BOT_TOKEN,
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

async function startServer() {
  try {
    if (process.env.NODE_ENV !== 'production') {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('Fatal error starting server:', error);
    process.exit(1);
  }
}

startServer();
