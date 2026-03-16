/**
 * db.js — SQLite database setup & seed data
 * Uses sql.js (pure JavaScript/WASM — no native compilation required)
 */

const bcrypt = require('bcryptjs');
const path   = require('path');
const fs     = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'store.db');

let sqlDb = null; // raw sql.js Database instance

// ── SAVE DB TO DISK ───────────────────────────────────────────────────────────

function saveDb() {
  if (!sqlDb) return;
  try {
    const data = sqlDb.export();
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (e) {
    console.error('Warning: could not save database:', e.message);
  }
}

// Save on process exit
process.on('exit', saveDb);
process.on('SIGINT',  () => { saveDb(); process.exit(0); });
process.on('SIGTERM', () => { saveDb(); process.exit(0); });

// ── PARAMETER NORMALIZER ──────────────────────────────────────────────────────

function normalizeParams(args) {
  if (args.length === 0) return [];
  if (args.length === 1 && Array.isArray(args[0])) return args[0];
  return Array.from(args);
}

// ── PREPARED STATEMENT WRAPPER ────────────────────────────────────────────────
// Provides a better-sqlite3-compatible API on top of sql.js

function prepare(sql) {
  return {
    // Execute a write statement, returns { lastInsertRowid, changes }
    run(...args) {
      const params = normalizeParams(args);
      sqlDb.run(sql, params);
      const idResult = sqlDb.exec('SELECT last_insert_rowid()');
      const lastInsertRowid = idResult[0]?.values[0]?.[0] ?? 0;
      const changes = sqlDb.getRowsModified();
      saveDb();
      return { lastInsertRowid, changes };
    },

    // Fetch a single row as an object (or undefined)
    get(...args) {
      const params = normalizeParams(args);
      const stmt = sqlDb.prepare(sql);
      try {
        stmt.bind(params);
        if (stmt.step()) return stmt.getAsObject();
        return undefined;
      } finally {
        stmt.free();
      }
    },

    // Fetch all matching rows as an array of objects
    all(...args) {
      const params = normalizeParams(args);
      const stmt = sqlDb.prepare(sql);
      const results = [];
      try {
        stmt.bind(params);
        while (stmt.step()) results.push(stmt.getAsObject());
      } finally {
        stmt.free();
      }
      return results;
    }
  };
}

// ── TRANSACTION WRAPPER ───────────────────────────────────────────────────────

function transaction(fn) {
  return function (...args) {
    sqlDb.run('BEGIN');
    try {
      const result = fn(...args);
      sqlDb.run('COMMIT');
      saveDb();
      return result;
    } catch (e) {
      sqlDb.run('ROLLBACK');
      throw e;
    }
  };
}

// ── EXEC (multi-statement SQL) ────────────────────────────────────────────────

function exec(sql) {
  sqlDb.exec(sql);
  saveDb();
}

// ── SCHEMA ────────────────────────────────────────────────────────────────────

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS admins (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    email       TEXT    UNIQUE NOT NULL,
    password    TEXT    NOT NULL,
    name        TEXT    NOT NULL DEFAULT 'Admin',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    slug        TEXT    UNIQUE NOT NULL,
    description TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    name          TEXT    NOT NULL,
    slug          TEXT    UNIQUE NOT NULL,
    description   TEXT,
    price         INTEGER NOT NULL,
    compare_price INTEGER,
    stock         INTEGER NOT NULL DEFAULT 0,
    sku           TEXT,
    image_url     TEXT,
    badge         TEXT,
    active        INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number     TEXT    UNIQUE NOT NULL,
    stripe_session   TEXT    UNIQUE,
    stripe_payment   TEXT,
    status           TEXT    NOT NULL DEFAULT 'pending',
    customer_name    TEXT    NOT NULL,
    customer_email   TEXT    NOT NULL,
    customer_phone   TEXT,
    shipping_address TEXT,
    subtotal         INTEGER NOT NULL,
    shipping         INTEGER NOT NULL DEFAULT 0,
    tax              INTEGER NOT NULL DEFAULT 0,
    total            INTEGER NOT NULL,
    notes            TEXT,
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    name       TEXT    NOT NULL,
    price      INTEGER NOT NULL,
    quantity   INTEGER NOT NULL,
    subtotal   INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
  CREATE INDEX IF NOT EXISTS idx_products_active   ON products(active);
  CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_email      ON orders(customer_email);
  CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
`;

// ── SEED ADMIN ────────────────────────────────────────────────────────────────

function seedAdmin() {
  const existing = prepare('SELECT id FROM admins LIMIT 1').get();
  if (existing) return;

  const email    = process.env.ADMIN_EMAIL    || 'admin@yourstore.com';
  const password = process.env.ADMIN_PASSWORD || 'changeme123';
  const hash     = bcrypt.hashSync(password, 12);

  prepare('INSERT INTO admins (email, password, name) VALUES (?, ?, ?)').run(email, hash, 'Admin');
  console.log(`✅ Admin account created: ${email}`);
}

// ── SEED SAMPLE PRODUCTS ──────────────────────────────────────────────────────

function seedSampleData() {
  const count = prepare('SELECT COUNT(*) as c FROM products').get().c;
  if (count > 0) return;

  // ── CATEGORIES ──────────────────────────────────────────────────────────────
  const cat2 = prepare('INSERT INTO categories (name, slug, description, sort_order) VALUES (?, ?, ?, ?)').run('Electronics',      'electronics', 'Headphones, keyboards, and tech accessories', 1).lastInsertRowid;
  const cat3 = prepare('INSERT INTO categories (name, slug, description, sort_order) VALUES (?, ?, ?, ?)').run('Streetwear',       'streetwear',  'Hoodies, tees, joggers, and sneakers',        2).lastInsertRowid;
  const cat4 = prepare('INSERT INTO categories (name, slug, description, sort_order) VALUES (?, ?, ?, ?)').run('Skincare & Beauty','skincare',    'Serums, moisturizers, and glow essentials',   3).lastInsertRowid;
  const cat5 = prepare('INSERT INTO categories (name, slug, description, sort_order) VALUES (?, ?, ?, ?)').run('Accessories',      'accessories', 'Watches, wallets, sunglasses, and bags',      4).lastInsertRowid;

  const IMG = 'https://images.unsplash.com/photo-';
  const ins  = 'INSERT INTO products (category_id, name, slug, description, price, compare_price, stock, sku, image_url, badge, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)';

  // ── ELECTRONICS ─────────────────────────────────────────────────────────────
  prepare(ins).run(cat2, 'ANC Pro Wireless Headphones', 'anc-pro-wireless-headphones',
    'Industry-leading active noise cancellation with 40-hour battery life. Hi-Res Audio certified, foldable design, and multipoint Bluetooth for seamless device switching.',
    7999, 12999, 30, 'ELEC-001',
    `${IMG}1505740420928-5e560c06d30e?w=600&h=600&fit=crop&auto=format&q=80`, 'Sale');

  prepare(ins).run(cat2, 'RGB Mechanical Keyboard TKL', 'rgb-mechanical-keyboard-tkl',
    'Tenkeyless layout with premium tactile brown switches, per-key RGB, and aircraft-grade aluminium top case. USB-C detachable cable.',
    14999, null, 18, 'ELEC-002',
    `${IMG}1587829741301-dc798b83add3?w=600&h=600&fit=crop&auto=format&q=80`, 'Popular');

  prepare(ins).run(cat2, '20,000mAh Power Bank Ultra', 'power-bank-ultra-20k',
    '65W PD fast charging for laptops, tablets, and phones. Dual USB-A + USB-C outputs, LED battery indicator. TSA carry-on approved.',
    3999, 5999, 55, 'ELEC-003',
    null, 'Sale');

  prepare(ins).run(cat2, 'USB-C 7-in-1 Docking Hub', 'usb-c-7in1-docking-hub',
    'One cable connects it all: 4K HDMI, 100W PD pass-through, 3× USB-A, SD/microSD card readers. Plug-and-play, no drivers required.',
    4999, 7999, 42, 'ELEC-004',
    null, null);

  // ── STREETWEAR ──────────────────────────────────────────────────────────────
  prepare(ins).run(cat3, 'Heavyweight Oversized Hoodie', 'heavyweight-oversized-hoodie',
    'Ultra-thick 480gsm French terry cotton. Dropped shoulders, kangaroo pocket, and a relaxed boxy cut. Garment-dyed for a premium vintage wash. Unisex sizing.',
    6500, null, 85, 'CLO-001',
    `${IMG}1556821840-3a63f15732ce?w=600&h=600&fit=crop&auto=format&q=80`, 'New');

  prepare(ins).run(cat3, 'Vintage Washed Graphic Tee', 'vintage-washed-graphic-tee',
    'Heavyweight 280gsm ring-spun cotton with a retro acid-wash finish and screen-printed graphic. Slightly oversized cut, double-needle stitching.',
    3500, null, 110, 'CLO-002',
    `${IMG}1521572163474-6864f9cf17ab?w=600&h=600&fit=crop&auto=format&q=80`, null);

  prepare(ins).run(cat3, 'Cargo Utility Joggers', 'cargo-utility-joggers',
    'Six-pocket cargo joggers in 320gsm brushed fleece. Adjustable ankle cuffs, YKK zip pockets. The #1 trending athleisure silhouette of 2025.',
    7500, null, 60, 'CLO-003',
    null, 'Popular');

  prepare(ins).run(cat3, 'Classic White Leather Sneakers', 'classic-white-leather-sneakers',
    'Full-grain leather upper with a vulcanized cupsole. Clean minimal design that pairs with everything. Cushioned insole for all-day comfort.',
    9500, 12000, 40, 'CLO-004',
    `${IMG}1542291026-7eec264c27ff?w=600&h=600&fit=crop&auto=format&q=80`, 'Sale');

  // ── SKINCARE & BEAUTY ────────────────────────────────────────────────────────
  prepare(ins).run(cat4, '20% Vitamin C Brightening Serum', 'vitamin-c-brightening-serum',
    'Stabilized 20% L-Ascorbic Acid with Ferulic Acid and Vitamin E. Fades dark spots, boosts collagen, and leaves skin visibly luminous in 4 weeks.',
    4500, null, 70, 'SKIN-001',
    `${IMG}1556228578-0d85b1a4d571?w=600&h=600&fit=crop&auto=format&q=80`, 'Popular');

  prepare(ins).run(cat4, 'Hyaluronic Acid Glow Moisturizer', 'hyaluronic-acid-glow-moisturizer',
    'Multi-weight Hyaluronic Acid complex draws moisture deep into the skin. Fragrance-free, non-comedogenic. Dermatologist tested for all skin types.',
    3800, null, 90, 'SKIN-002',
    null, null);

  prepare(ins).run(cat4, 'Deep Cleanse Face Mask Set (3-pack)', 'deep-cleanse-face-mask-set',
    'Three targeted masks: Kaolin Clay for pores, Overnight Retinol for renewal, and Green Tea Sheet for hydration. Spa results at home.',
    2999, 3999, 55, 'SKIN-003',
    null, 'Sale');

  // ── ACCESSORIES ──────────────────────────────────────────────────────────────
  prepare(ins).run(cat5, 'Slim Minimalist Quartz Watch', 'slim-minimalist-quartz-watch',
    'Japanese quartz movement in a 40mm case. Sapphire crystal glass, genuine leather strap, water resistant to 50m. Timeless Bauhaus-inspired design.',
    8999, null, 25, 'ACC-001',
    `${IMG}1523275335684-37898b6baf30?w=600&h=600&fit=crop&auto=format&q=80`, 'Popular');

  prepare(ins).run(cat5, 'RFID Bifold Leather Wallet', 'rfid-bifold-leather-wallet',
    'Full-grain vegetable-tanned leather with RFID-blocking lining. 6 card slots, 2 bill compartments, slim profile at just 8mm. Ages beautifully.',
    4999, null, 48, 'ACC-002',
    null, null);

  prepare(ins).run(cat5, 'Polarized Aviator Sunglasses', 'polarized-aviator-sunglasses',
    'Polarized G15 lenses with 100% UV400 protection. Spring-hinge titanium frame, feather-light at 22g. Comes with premium case and cleaning cloth.',
    5500, null, 35, 'ACC-003',
    `${IMG}1572635196237-14b3f281503f?w=600&h=600&fit=crop&auto=format&q=80`, null);

  prepare(ins).run(cat5, 'Canvas Everyday Backpack', 'canvas-everyday-backpack',
    '30L waxed canvas backpack with padded 16" laptop sleeve, YKK zippers, and vegetable leather trim. Water-resistant, carry-on compliant.',
    6500, 8500, 30, 'ACC-004',
    `${IMG}1553062407-98eeb64c6a62?w=600&h=600&fit=crop&auto=format&q=80`, 'Sale');

  // Default settings
  const setq = 'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)';
  prepare(setq).run('store_name',               process.env.STORE_NAME     || "Sofia's Store");
  prepare(setq).run('store_currency',           process.env.STORE_CURRENCY || 'USD');
  prepare(setq).run('tax_rate',                 '0');
  prepare(setq).run('shipping_flat',            '0');
  prepare(setq).run('free_shipping_threshold',  '0');

  console.log('✅ Sample products and categories seeded');
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

const helpers = {
  formatPrice(cents) {
    return (cents / 100).toFixed(2);
  },

  generateOrderNumber() {
    const now = new Date();
    const ymd  = now.toISOString().slice(2, 10).replace(/-/g, '');
    const rand = Math.floor(Math.random() * 9000 + 1000);
    return `ORD-${ymd}-${rand}`;
  },

  getSettings() {
    const rows = prepare('SELECT key, value FROM settings').all();
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  },

  updateSetting(key, value) {
    prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  }
};

// ── PUBLIC DB OBJECT ──────────────────────────────────────────────────────────
// Exposes a better-sqlite3-compatible interface

const db = {
  prepare,
  exec,
  transaction,
  helpers,

  // Async initializer — call once at startup before routes handle requests
  async init() {
    if (sqlDb) return this; // already initialized

    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs({
      locateFile: file => path.join(require.resolve('sql.js'), '..', file)
    });

    // Load existing DB from disk, or create fresh
    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      sqlDb = new SQL.Database(buffer);
      console.log('✅ Database loaded from disk');
    } else {
      sqlDb = new SQL.Database();
      console.log('✅ New database created');
    }

    // Enable foreign keys
    sqlDb.run('PRAGMA foreign_keys = ON');

    // Create schema
    sqlDb.exec(SCHEMA);
    saveDb();

    // Seed data
    seedAdmin();
    seedSampleData();

    return this;
  }
};

module.exports = db;
