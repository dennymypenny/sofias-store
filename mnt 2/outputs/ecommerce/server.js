/**
 * server.js â Main Express application
 */

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

async function start() {
  // ââ INIT DATABASE (must happen before routes handle requests) âââââââââââââââ
  const db = require('./db');
  await db.init();

  // ââ MIDDLEWARE ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  // Raw body needed for Stripe webhook â must come BEFORE express.json()
  app.use('/api/checkout/webhook', express.raw({ type: 'application/json' }));

  // Trust Railway's reverse proxy so secure cookies work over HTTPS
  app.set('trust proxy', 1);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
      }
    }
  }));

  // Session â using session-file-store (pure JS, no native compilation)
  const FileStore = require('session-file-store')(session);
  const sessionsDir = path.join(__dirname, 'data', 'sessions');
  fs.mkdirSync(sessionsDir, { recursive: true });

  app.use(session({
    store: new FileStore({
      path: sessionsDir,
      ttl: 7 * 24 * 60 * 60,  // 7 days in seconds
      retries: 1,
      logFn: () => {}          // suppress verbose file-store logs
    }),
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days in ms
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production'
    }
  }));

  // ââ ROUTES ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  app.use('/api/products',  require('./routes/products'));
  app.use('/api/cart',      require('./routes/cart'));
  app.use('/api/checkout',  require('./routes/checkout'));
  app.use('/api/orders',    require('./routes/orders'));
  app.use('/api/admin',     require('./routes/admin'));

  // ââ SPA FALLBACK ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  app.get('*', (req, res) => {
    if (req.path.startsWith('/admin')) {
      return res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  // ââ ERROR HANDLER âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  app.use((err, req, res, next) => {
    console.error(err.stack);
    const status  = err.statusCode || 500;
    const message = process.env.NODE_ENV === 'production'
      ? 'Something went wrong'
      : err.message;
    res.status(status).json({ error: message });
  });

  // ââ START âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  app.listen(PORT, () => {
    console.log(`\nð  Store running at http://localhost:${PORT}`);
    console.log(`ð  Admin dashboard: http://localhost:${PORT}/admin`);
    console.log(`\nð  Admin email:    ${process.env.ADMIN_EMAIL || 'admin@yourstore.com'}`);
    console.log(`ð  Admin password: (see .env or default 'changeme123')\n`);
  });
}

start().catch(err => {
  console.error('â Failed to start server:', err);
  process.exit(1);
});

module.exports = app;
