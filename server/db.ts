import mysql from 'mysql2/promise';
import crypto from 'crypto';

export interface DbUser {
  id: string;
  email: string;
  password_hash: string;
  salt: string;
  full_name: string;
  role: 'owner' | 'manager' | 'agency';
  created_at?: string;
}

export interface DbCompany {
  id: string;
  user_id: string;
  name: string;
  legal_name?: string;
  category: string;
  city: string;
  phone?: string;
  website?: string;
  google_place_id?: string;
  autopilot_enabled: boolean;
  score: number;
  rank_position?: number;
  created_at?: string;
}

export interface DbLead {
  id: string;
  company_id?: string;
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

export interface DbCompanyData {
  company_id: string;
  growth_score: any;
  audit_items: any[];
  reviews: any[];
  keywords: any[];
  competitors: any[];
  posts: any[];
  campaigns: any[];
  autonomous_actions: any[];
  updated_at?: string;
}

let pool: mysql.Pool | null = null;
let isMySqlAvailable = false;
let tablesInitialized = false;

// Password security helpers using native Node crypto
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return verifyHash === hash;
}

// In-Memory stores for seamless fallback and development
const inMemoryUsers: DbUser[] = [
  // Default master admin account for instant access
  (() => {
    const { hash, salt } = hashPassword('Aaditech@2026');
    return {
      id: 'usr_aaditech_master',
      email: 'admin@aaditechs.in',
      password_hash: hash,
      salt,
      full_name: 'Aaditech Admin',
      role: 'owner',
      created_at: new Date().toISOString(),
    };
  })(),
];

const inMemoryCompanies: DbCompany[] = [];
const inMemoryCompanyData: Record<string, DbCompanyData> = {};
const inMemoryLeads: DbLead[] = [];

// Initialize MySQL pool lazily & auto-create tables
export async function getDbPool(): Promise<mysql.Pool | null> {
  if (pool) return pool;

  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;
  const port = Number(process.env.DB_PORT) || 3306;

  if (!host || !database || !user) {
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

    if (!tablesInitialized) {
      await autoInitializeTables(pool);
      tablesInitialized = true;
    }

    return pool;
  } catch (err: any) {
    console.warn(`[Hostinger MySQL] Could not connect to MySQL (${err?.message}). Running with resilient in-memory store.`);
    pool = null;
    isMySqlAvailable = false;
    return null;
  }
}

// Auto-create relational tables for users, companies, profiles & leads
async function autoInitializeTables(dbPool: mysql.Pool) {
  try {
    const connection = await dbPool.getConnection();
    try {
      // 1. Users table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(64) PRIMARY KEY,
          email VARCHAR(191) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          salt VARCHAR(64) NOT NULL,
          full_name VARCHAR(128) NOT NULL,
          role VARCHAR(32) DEFAULT 'owner',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 2. Companies table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS companies (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL,
          name VARCHAR(191) NOT NULL,
          legal_name VARCHAR(191),
          category VARCHAR(128) NOT NULL,
          city VARCHAR(128) NOT NULL,
          phone VARCHAR(64),
          website VARCHAR(255),
          google_place_id VARCHAR(128),
          autopilot_enabled TINYINT(1) DEFAULT 1,
          score INT DEFAULT 75,
          rank_position INT DEFAULT 3,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 3. Company Data (Isolated metrics, audits, competitors, etc.)
      await connection.query(`
        CREATE TABLE IF NOT EXISTS company_profiles_data (
          company_id VARCHAR(64) PRIMARY KEY,
          data_payload LONGTEXT NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 4. Leads table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS leads (
          id VARCHAR(64) PRIMARY KEY,
          company_id VARCHAR(64),
          name VARCHAR(128) NOT NULL,
          company VARCHAR(128),
          phone VARCHAR(64) NOT NULL,
          email VARCHAR(191),
          service VARCHAR(191),
          budget VARCHAR(64),
          stage VARCHAR(32) DEFAULT 'new',
          intent_score INT DEFAULT 85,
          source VARCHAR(64),
          notes TEXT,
          ai_suggested_reply TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_company_lead (company_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      console.log('[Hostinger MySQL] Relational Multi-Tenant Tables verified & ready!');
    } finally {
      connection.release();
    }
  } catch (err: any) {
    console.warn('[Hostinger MySQL] Table auto-initialization error (proceeding safely):', err?.message);
  }
}

// ---------------- USER AUTHENTICATION ---------------- //

export async function findUserByEmail(email: string): Promise<DbUser | null> {
  const cleanEmail = email.toLowerCase().trim();
  try {
    const db = await getDbPool();
    if (db) {
      const [rows]: any = await db.query('SELECT * FROM users WHERE email = ? LIMIT 1', [cleanEmail]);
      if (rows && rows.length > 0) {
        return rows[0] as DbUser;
      }
      return null;
    }
  } catch (err: any) {
    console.warn('[findUserByEmail] MySQL error:', err?.message);
  }

  return inMemoryUsers.find((u) => u.email.toLowerCase() === cleanEmail) || null;
}

export async function findUserById(id: string): Promise<DbUser | null> {
  try {
    const db = await getDbPool();
    if (db) {
      const [rows]: any = await db.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
      if (rows && rows.length > 0) {
        return rows[0] as DbUser;
      }
      return null;
    }
  } catch (err: any) {
    console.warn('[findUserById] MySQL error:', err?.message);
  }

  return inMemoryUsers.find((u) => u.id === id) || null;
}

export async function createUser(data: {
  email: string;
  password: string;
  full_name: string;
  role?: 'owner' | 'manager' | 'agency';
}): Promise<DbUser> {
  const { hash, salt } = hashPassword(data.password);
  const newUser: DbUser = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    email: data.email.toLowerCase().trim(),
    password_hash: hash,
    salt,
    full_name: data.full_name.trim(),
    role: data.role || 'owner',
    created_at: new Date().toISOString(),
  };

  try {
    const db = await getDbPool();
    if (db) {
      await db.query(
        'INSERT INTO users (id, email, password_hash, salt, full_name, role) VALUES (?, ?, ?, ?, ?, ?)',
        [newUser.id, newUser.email, newUser.password_hash, newUser.salt, newUser.full_name, newUser.role]
      );
      return newUser;
    }
  } catch (err: any) {
    console.warn('[createUser] MySQL error:', err?.message);
  }

  inMemoryUsers.push(newUser);
  return newUser;
}

// ---------------- MULTI-COMPANY MANAGEMENT ---------------- //

export async function getUserCompanies(userId: string): Promise<DbCompany[]> {
  try {
    const db = await getDbPool();
    if (db) {
      const [rows]: any = await db.query('SELECT * FROM companies WHERE user_id = ? ORDER BY created_at ASC', [userId]);
      return rows as DbCompany[];
    }
  } catch (err: any) {
    console.warn('[getUserCompanies] MySQL error:', err?.message);
  }

  return inMemoryCompanies.filter((c) => c.user_id === userId);
}

export async function getCompanyById(companyId: string): Promise<DbCompany | null> {
  try {
    const db = await getDbPool();
    if (db) {
      const [rows]: any = await db.query('SELECT * FROM companies WHERE id = ? LIMIT 1', [companyId]);
      if (rows && rows.length > 0) return rows[0] as DbCompany;
      return null;
    }
  } catch (err: any) {
    console.warn('[getCompanyById] MySQL error:', err?.message);
  }

  return inMemoryCompanies.find((c) => c.id === companyId) || null;
}

export async function createCompany(data: {
  user_id: string;
  name: string;
  legal_name?: string;
  category: string;
  city: string;
  phone?: string;
  website?: string;
  google_place_id?: string;
}): Promise<DbCompany> {
  const newCompany: DbCompany = {
    id: `comp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    user_id: data.user_id,
    name: data.name.trim(),
    legal_name: data.legal_name?.trim() || data.name.trim(),
    category: data.category.trim(),
    city: data.city.trim(),
    phone: data.phone || '+91 98200 12345',
    website: data.website || '',
    google_place_id: data.google_place_id || '',
    autopilot_enabled: true,
    score: 82,
    rank_position: 2,
    created_at: new Date().toISOString(),
  };

  try {
    const db = await getDbPool();
    if (db) {
      await db.query(
        `INSERT INTO companies (id, user_id, name, legal_name, category, city, phone, website, google_place_id, autopilot_enabled, score, rank_position)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newCompany.id,
          newCompany.user_id,
          newCompany.name,
          newCompany.legal_name,
          newCompany.category,
          newCompany.city,
          newCompany.phone,
          newCompany.website,
          newCompany.google_place_id,
          newCompany.autopilot_enabled ? 1 : 0,
          newCompany.score,
          newCompany.rank_position,
        ]
      );
      return newCompany;
    }
  } catch (err: any) {
    console.warn('[createCompany] MySQL error:', err?.message);
  }

  inMemoryCompanies.push(newCompany);
  return newCompany;
}

export async function getCompanyDataPayload(companyId: string): Promise<DbCompanyData | null> {
  try {
    const db = await getDbPool();
    if (db) {
      const [rows]: any = await db.query('SELECT data_payload FROM company_profiles_data WHERE company_id = ? LIMIT 1', [companyId]);
      if (rows && rows.length > 0) {
        return JSON.parse(rows[0].data_payload);
      }
      return null;
    }
  } catch (err: any) {
    console.warn('[getCompanyDataPayload] MySQL error:', err?.message);
  }

  return inMemoryCompanyData[companyId] || null;
}

export async function saveCompanyDataPayload(companyId: string, payload: any): Promise<boolean> {
  const jsonString = JSON.stringify(payload);
  try {
    const db = await getDbPool();
    if (db) {
      await db.query(
        `INSERT INTO company_profiles_data (company_id, data_payload)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE data_payload = ?`,
        [companyId, jsonString, jsonString]
      );
      return true;
    }
  } catch (err: any) {
    console.warn('[saveCompanyDataPayload] MySQL error:', err?.message);
  }

  inMemoryCompanyData[companyId] = payload;
  return true;
}

// ---------------- LEADS MANAGEMENT ---------------- //

export async function getAllLeads(companyId?: string): Promise<DbLead[]> {
  try {
    const db = await getDbPool();
    if (db) {
      if (companyId) {
        const [rows] = await db.query('SELECT * FROM leads WHERE company_id = ? ORDER BY created_at DESC', [companyId]);
        return rows as DbLead[];
      }
      const [rows] = await db.query('SELECT * FROM leads ORDER BY created_at DESC');
      return rows as DbLead[];
    }
  } catch (err: any) {
    console.warn('[getAllLeads] MySQL error, fallback to memory:', err?.message);
  }

  if (companyId) {
    return inMemoryLeads.filter((l) => !l.company_id || l.company_id === companyId);
  }
  return inMemoryLeads;
}

export async function createLead(lead: Omit<DbLead, 'id'> & { id?: string }): Promise<DbLead> {
  const newLead: DbLead = {
    id: lead.id || `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    company_id: lead.company_id || undefined,
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
        `INSERT INTO leads (id, company_id, name, company, phone, email, service, budget, stage, intent_score, source, notes, ai_suggested_reply)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newLead.id,
          newLead.company_id || null,
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

// ---------------- TELEGRAM DISPATCH ---------------- //

export async function sendTelegramPushAlert(message: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
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

