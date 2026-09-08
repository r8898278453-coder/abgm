import mysql from 'mysql2/promise';

export interface DbLead {
  id: string;
  name: string;
  company?: string;
  phone: string;
  email?: string;
  service: string;
  budget?: string;
  stage: 'new' | 'contacted' | 'qualified' | 'quotation' | 'won' | 'lost';
  intent_score: number;
  source: string;
  notes?: string;
  ai_suggested_reply?: string;
  created_at?: string;
}

let pool: mysql.Pool | null = null;
let isMySqlAvailable = false;

// Initialize MySQL pool lazily
export async function getDbPool(): Promise<mysql.Pool | null> {
  if (pool) return pool;

  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;
  const port = Number(process.env.DB_PORT) || 3306;

  if (!host || !database || !user) {
    // MySQL not configured, fallback to in-memory store
    return null;
  }

  try {
    pool = mysql.createPool({
      host,
      user,
      password: password || '',
      database,
      port,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 5000,
    });

    // Test ping
    const connection = await pool.getConnection();
    connection.release();
    isMySqlAvailable = true;
    console.log(`[Hostinger MySQL] Successfully connected to database: ${database} at ${host}`);
    return pool;
  } catch (err: any) {
    console.warn(`[Hostinger MySQL] Could not connect to MySQL (${err?.message}). Running with resilient in-memory store.`);
    pool = null;
    isMySqlAvailable = false;
    return null;
  }
}

// In-Memory fallback store if MySQL is not yet configured or reachable
const inMemoryLeads: DbLead[] = [
  {
    id: 'lead_1',
    name: 'Rajesh Singhania',
    company: 'Singhania Logistics MMR',
    phone: '+91 98201 44520',
    email: 'rajesh@singhanialogistics.in',
    service: 'Android Fleet Management App & Billing ERP',
    budget: '₹65,000',
    stage: 'new',
    intent_score: 96,
    source: 'Website Form',
    ai_suggested_reply:
      'Namaste Rajesh ji! Aaditech Solution (bga.aaditechs.in) se humne aapki logistics fleet app requirement review ki. Humne Thane & Navi Mumbai ke 12+ transport operators ke liye custom tracking solutions live kiye hain. Kya hum aaj live demo schedule karein?',
  },
  {
    id: 'lead_2',
    name: 'Dr. Sneha Patwardhan',
    company: 'Patwardhan Multispecialty Dental',
    phone: '+91 98192 33410',
    email: 'dr.sneha@patwardhandental.com',
    service: 'Google 3-Pack Local SEO & WhatsApp Patient Booking',
    budget: '₹18,000/mo',
    stage: 'contacted',
    intent_score: 88,
    source: 'Google 3-Pack Call',
    ai_suggested_reply:
      'Hello Dr. Sneha! Thank you for contacting Aaditech Solution. We reviewed your clinic listing. Adding WhatsApp appointment booking and localized 3-pack optimization will directly increase high-ticket implant consults. Sharing sample case study!',
  },
];

// Fetch all leads
export async function getAllLeads(): Promise<DbLead[]> {
  try {
    const db = await getDbPool();
    if (db) {
      const [rows] = await db.query('SELECT * FROM leads ORDER BY created_at DESC');
      return rows as DbLead[];
    }
  } catch (err: any) {
    console.warn('[getAllLeads] MySQL error, fallback to memory:', err?.message);
  }
  return inMemoryLeads;
}

// Insert new lead (from website form or API webhook)
export async function createLead(lead: Omit<DbLead, 'id'> & { id?: string }): Promise<DbLead> {
  const newLead: DbLead = {
    id: lead.id || `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: lead.name,
    company: lead.company || 'Direct Client',
    phone: lead.phone,
    email: lead.email || '',
    service: lead.service || 'Website / Software Inquiry',
    budget: lead.budget || 'Custom Quote',
    stage: lead.stage || 'new',
    intent_score: lead.intent_score || 85,
    source: lead.source || 'bga.aaditechs.in',
    notes: lead.notes || '',
    ai_suggested_reply:
      lead.ai_suggested_reply ||
      `Namaste ${lead.name}! Aaditech Solution (bga.aaditechs.in) se message hai. Humne aapki requirement receive kar li hai. Team will contact you shortly!`,
  };

  try {
    const db = await getDbPool();
    if (db) {
      await db.query(
        `INSERT INTO leads (id, name, company, phone, email, service, budget, stage, intent_score, source, notes, ai_suggested_reply)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newLead.id,
          newLead.name,
          newLead.company,
          newLead.phone,
          newLead.email,
          newLead.service,
          newLead.budget,
          newLead.stage,
          newLead.intent_score,
          newLead.source,
          newLead.notes,
          newLead.ai_suggested_reply,
        ]
      );
      return newLead;
    }
  } catch (err: any) {
    console.warn('[createLead] MySQL query error, stored in memory:', err?.message);
  }

  inMemoryLeads.unshift(newLead);
  return newLead;
}

// Update lead stage
export async function updateLeadStatus(id: string, stage: DbLead['stage']): Promise<boolean> {
  try {
    const db = await getDbPool();
    if (db) {
      await db.query('UPDATE leads SET stage = ? WHERE id = ?', [stage, id]);
      return true;
    }
  } catch (err: any) {
    console.warn('[updateLeadStatus] MySQL error:', err?.message);
  }

  const existing = inMemoryLeads.find((l) => l.id === id);
  if (existing) {
    existing.stage = stage;
    return true;
  }
  return false;
}

// Dispatch Telegram Push Alert to Smartphone
export async function sendTelegramPushAlert(message: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    // Config not supplied yet; safely skip
    return false;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch (err: any) {
    console.warn('[sendTelegramPushAlert] Failed to send Telegram alert:', err?.message);
    return false;
  }
}
