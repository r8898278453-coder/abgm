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

export function getDbStatus(): { connected: boolean; provider: 'mysql' | 'in-memory'; configured: boolean } {
  return {
    connected: isMySqlAvailable,
    provider: isMySqlAvailable ? 'mysql' : 'in-memory',
    configured: Boolean(process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER),
  };
}

// OWASP standard PBKDF2 iteration count for HMAC-SHA512 (minimum 210,000 iterations)
export const PBKDF2_ITERATIONS = 210000;
const LEGACY_PBKDF2_ITERATIONS = 1000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = 'sha512';

function safeTimingCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

// Password security helpers using native Node crypto with OWASP-hardened parameters
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  if (!password || !hash || !salt) return false;

  // Primary verification using OWASP 210,000 iterations
  const primaryHash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');
  if (safeTimingCompare(primaryHash, hash)) {
    return true;
  }

  // Graceful backward-compatibility check for any pre-existing legacy hashes
  const legacyHash = crypto.pbkdf2Sync(password, salt, LEGACY_PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');
  if (safeTimingCompare(legacyHash, hash)) {
    return true;
  }

  return false;
}

export async function upgradeUserPassword(userId: string, newPlainPassword: string): Promise<void> {
  try {
    const memUser = inMemoryUsers.find((u) => u.id === userId);
    let currentHash = memUser?.password_hash;
    let currentSalt = memUser?.salt;

    const db = await getDbPool();
    if (db) {
      const [rows]: any = await db.query('SELECT password_hash, salt FROM users WHERE id = ? LIMIT 1', [userId]);
      if (rows && rows.length > 0) {
        currentHash = rows[0].password_hash;
        currentSalt = rows[0].salt;
      }
    }

    if (currentSalt && currentHash) {
      const expectedPrimary = crypto.pbkdf2Sync(newPlainPassword, currentSalt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex');
      if (safeTimingCompare(expectedPrimary, currentHash)) {
        // Already hashed with OWASP 210,000 iterations
        return;
      }
    }

    const { hash, salt } = hashPassword(newPlainPassword);
    if (db) {
      await db.query('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?', [hash, salt, userId]);
    }
    if (memUser) {
      memUser.password_hash = hash;
      memUser.salt = salt;
    }
    console.log(`[Security] Upgraded user password hash to OWASP 210,000 iterations for user: ${userId}`);
  } catch (err: any) {
    console.warn('[upgradeUserPassword] error:', err?.message);
  }
}

// In-Memory stores for development fallback (no hardcoded backdoor credentials)
function getInitialEnvAdmin(): DbUser[] {
  const envEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const envPass = process.env.INITIAL_ADMIN_PASSWORD?.trim();
  if (envEmail && envPass) {
    const { hash, salt } = hashPassword(envPass);
    return [{
      id: `usr_${crypto.randomUUID().replace(/-/g, '')}`,
      email: envEmail,
      password_hash: hash,
      salt,
      full_name: process.env.INITIAL_ADMIN_NAME?.trim() || 'System Administrator',
      role: 'owner',
      created_at: new Date().toISOString(),
    }];
  }
  return [];
}

const inMemoryUsers: DbUser[] = getInitialEnvAdmin();

const defaultSeedCompany: DbCompany = {
  id: 'comp_aaditech_main',
  user_id: 'usr_system_default',
  name: 'Aaditech Solution',
  legal_name: 'Aaditech Solution Private Limited',
  category: 'IT Services, Software Development & Local SEO Growth Engine',
  city: 'Thane - Mumbai MMR',
  phone: '+91 22 4963 8603',
  website: 'https://bga.aaditechs.in',
  google_place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
  autopilot_enabled: true,
  score: 82,
  rank_position: 2,
  created_at: new Date().toISOString(),
};

const inMemoryCompanies: DbCompany[] = [defaultSeedCompany];
const inMemoryCompanyData: Record<string, DbCompanyData> = {};
const inMemoryLeads: DbLead[] = [];

/**
 * Returns the primary/default company ID from MySQL or in-memory fallback.
 * Ensures leads submitted via public channels are never orphaned.
 */
export async function getDefaultCompanyId(): Promise<string | null> {
  try {
    const db = await getDbPool();
    if (db) {
      const [rows]: any = await db.query('SELECT id FROM companies ORDER BY created_at ASC LIMIT 1');
      if (rows && rows.length > 0) return rows[0].id;
    }
  } catch (err: any) {
    console.warn('[getDefaultCompanyId] MySQL error:', err?.message);
  }
  return inMemoryCompanies[0]?.id || null;
}

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

      // Optional: Seed initial admin in MySQL if explicitly configured in environment variables
      const envAdminEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
      const envAdminPass = process.env.INITIAL_ADMIN_PASSWORD?.trim();
      if (envAdminEmail && envAdminPass) {
        const [existing]: any = await connection.query('SELECT id FROM users WHERE email = ? LIMIT 1', [envAdminEmail]);
        if (!existing || existing.length === 0) {
          const { hash: adminHash, salt: adminSalt } = hashPassword(envAdminPass);
          const adminId = `usr_${crypto.randomUUID().replace(/-/g, '')}`;
          const adminName = process.env.INITIAL_ADMIN_NAME?.trim() || 'System Administrator';
          await connection.query(`
            INSERT INTO users (id, email, password_hash, salt, full_name, role)
            VALUES (?, ?, ?, ?, ?, 'owner')
          `, [adminId, envAdminEmail, adminHash, adminSalt, adminName]);
          console.log(`[Hostinger MySQL] Initial administrator provisioned for: ${envAdminEmail}`);
        }
      }

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

      // Seed default flagship company if no companies exist yet
      const [existingCompanies]: any = await connection.query('SELECT id FROM companies LIMIT 1');
      if (!existingCompanies || existingCompanies.length === 0) {
        await connection.query(`
          INSERT INTO companies (id, user_id, name, legal_name, category, city, phone, website, google_place_id, autopilot_enabled, score, rank_position)
          VALUES ('comp_aaditech_main', 'usr_system_default', 'Aaditech Solution', 'Aaditech Solution Private Limited', 'IT Services, Software Development & Local SEO Growth Engine', 'Thane - Mumbai MMR', '+91 22 4963 8603', 'https://bga.aaditechs.in', 'ChIJN1t_tDeuEmsRUsoyG83frY4', 1, 82, 2)
        `);
        console.log('[Hostinger MySQL] Initial flagship company provisioned: comp_aaditech_main');
      }

      // 3. Company Data (Isolated metrics, audits, competitors, etc.)
      await connection.query(`
        CREATE TABLE IF NOT EXISTS company_profiles_data (
          company_id VARCHAR(64) PRIMARY KEY,
          data_payload LONGTEXT NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 4. Leads table with company isolation
      await connection.query(`
        CREATE TABLE IF NOT EXISTS leads (
          id VARCHAR(64) PRIMARY KEY,
          company_id VARCHAR(64) DEFAULT NULL,
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

      // Proactive Self-Healing Migration:
      // If leads table exists from a legacy schema.sql import without company_id column,
      // dynamically verify and add the column & index to prevent unknown column runtime errors!
      try {
        const [leadColumns]: any = await connection.query(`
          SELECT COLUMN_NAME
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'leads'
            AND COLUMN_NAME = 'company_id'
        `);
        if (!leadColumns || leadColumns.length === 0) {
          console.log('[Hostinger MySQL] Self-healing schema: Adding missing company_id column to leads table...');
          await connection.query(`
            ALTER TABLE leads
            ADD COLUMN company_id VARCHAR(64) DEFAULT NULL AFTER id,
            ADD INDEX idx_company_lead (company_id)
          `);
          console.log('[Hostinger MySQL] Self-healing complete: company_id column added to leads table.');
        }
      } catch (colErr: any) {
        console.warn('[Hostinger MySQL] Leads column verification notice:', colErr?.message);
      }

      // 5. Reviews table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS reviews (
          id VARCHAR(64) PRIMARY KEY,
          company_id VARCHAR(64) DEFAULT NULL,
          author VARCHAR(255) NOT NULL,
          rating INT DEFAULT 5,
          date VARCHAR(64) NOT NULL,
          relative_time VARCHAR(64),
          content TEXT NOT NULL,
          sentiment VARCHAR(32) DEFAULT 'positive',
          topic VARCHAR(128),
          is_operational_issue TINYINT(1) DEFAULT 0,
          replied TINYINT(1) DEFAULT 0,
          reply_text TEXT,
          reply_date VARCHAR(64),
          source VARCHAR(32) DEFAULT 'google',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_company_review (company_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 6. Content Posts table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS content_posts (
          id VARCHAR(64) PRIMARY KEY,
          company_id VARCHAR(64) DEFAULT NULL,
          channel VARCHAR(64) NOT NULL,
          caption TEXT NOT NULL,
          image_url TEXT,
          status VARCHAR(32) DEFAULT 'scheduled',
          scheduled_time VARCHAR(64) NOT NULL,
          hashtags TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_company_post (company_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 7. Autonomous Actions table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS autonomous_actions (
          id VARCHAR(64) PRIMARY KEY,
          company_id VARCHAR(64) DEFAULT NULL,
          type VARCHAR(64) NOT NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT NOT NULL,
          impact VARCHAR(128),
          action_type VARCHAR(64) DEFAULT 'automatic',
          status VARCHAR(32) DEFAULT 'pending_approval',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_company_action (company_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 8. Business Profile table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS business_profile (
          id VARCHAR(64) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          category VARCHAR(255) NOT NULL,
          address TEXT NOT NULL,
          city VARCHAR(128) NOT NULL,
          phone VARCHAR(64) NOT NULL,
          email VARCHAR(255) NOT NULL,
          website VARCHAR(255) NOT NULL,
          whatsapp VARCHAR(64) NOT NULL,
          services_json JSON,
          settings_json JSON,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
    id: `usr_${crypto.randomUUID().replace(/-/g, '')}`,
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
    id: `comp_${crypto.randomUUID().replace(/-/g, '')}`,
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
    // Strict isolation: only return leads explicitly linked to this company
    return inMemoryLeads.filter((l) => l.company_id === companyId);
  }
  return inMemoryLeads;
}

export async function createLead(lead: Omit<DbLead, 'id'> & { id?: string }): Promise<DbLead> {
  // Ensure every lead is strictly bound to a company (never unlinked or orphaned)
  let resolvedCompanyId = lead.company_id;
  if (!resolvedCompanyId) {
    resolvedCompanyId = (await getDefaultCompanyId()) || undefined;
  }

  const newLead: DbLead = {
    id: lead.id || `lead_${crypto.randomUUID().replace(/-/g, '')}`,
    company_id: resolvedCompanyId,
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
    console.error('[createLead] MySQL query error:', err?.message);

    // Self-healing schema repair: if imported from a legacy schema without company_id column
    if (err?.code === 'ER_BAD_FIELD_ERROR' || String(err?.message || '').includes('company_id')) {
      try {
        const db = await getDbPool();
        if (db) {
          console.log('[createLead] Attempting automatic schema repair for missing company_id column...');
          await db.query('ALTER TABLE leads ADD COLUMN company_id VARCHAR(64) DEFAULT NULL AFTER id, ADD INDEX idx_company_lead (company_id)');
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
          console.log('[createLead] Successfully self-repaired schema and persisted lead to MySQL!');
          return newLead;
        }
      } catch (repairErr: any) {
        console.error('[createLead] Schema repair and retry failed:', repairErr?.message);
      }
    }
  }

  inMemoryLeads.unshift(newLead);
  return newLead;
}

export async function getLeadById(id: string): Promise<DbLead | null> {
  try {
    const db = await getDbPool();
    if (db) {
      const [rows]: any = await db.query('SELECT * FROM leads WHERE id = ? LIMIT 1', [id]);
      if (rows && rows.length > 0) return rows[0] as DbLead;
      return null;
    }
  } catch (err: any) {
    console.warn('[getLeadById] MySQL error:', err?.message);
  }

  return inMemoryLeads.find((l) => l.id === id) || null;
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

