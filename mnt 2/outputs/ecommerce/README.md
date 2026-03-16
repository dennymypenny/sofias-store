# 🛒 MyStore — Full-Stack E-commerce App

A complete Node.js + Express e-commerce application with Stripe payments, an admin dashboard, shopping cart, order tracking, and SQLite database. No separate database server required.

---

## ✨ Features

- **Storefront** — Product catalog with search, category filtering, and product detail modals
- **Shopping cart** — Session-based cart with quantity management and real-time totals
- **Stripe Checkout** — Secure hosted payment pages (you never handle raw card data)
- **Order tracking** — Customers can look up orders by email + order number
- **Admin dashboard** — Full management UI for orders, products, categories, and settings
- **SQLite database** — Zero-setup, file-based database (no PostgreSQL/MySQL needed)

---

## 📋 Prerequisites

- **Node.js 18+** — [Download here](https://nodejs.org)
- **npm** (comes with Node.js)
- **Stripe account** — [Free sign up](https://stripe.com) (test mode works without a business)

---

## 🚀 Quick Start (Local Development)

### 1. Install dependencies

```bash
cd ecommerce
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

```env
PORT=3000
SESSION_SECRET=pick-a-long-random-string-here

# Stripe keys — get these from https://dashboard.stripe.com/test/apikeys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...   # fill in after step 4

# Your local URL (used for Stripe redirect URLs)
STORE_URL=http://localhost:3000

# Admin login credentials
ADMIN_EMAIL=admin@yourstore.com
ADMIN_PASSWORD=changeme123

# Store info
STORE_NAME=My Store
STORE_CURRENCY=usd
```

### 3. Start the development server

```bash
npm run dev
```

> If `nodemon` isn't installed globally, run `npx nodemon server.js` or just `npm start`.

The server starts at **http://localhost:3000**

- 🏪 Storefront: http://localhost:3000
- 🔐 Admin dashboard: http://localhost:3000/admin

### 4. Set up Stripe webhooks (local)

Stripe needs to send payment confirmation events to your local machine. Install the [Stripe CLI](https://stripe.com/docs/stripe-cli):

```bash
# macOS (Homebrew)
brew install stripe/stripe-cli/stripe

# Windows (Scoop)
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe
```

Log in and forward webhooks:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/checkout/webhook
```

The CLI will print a `whsec_...` signing secret — copy it into your `.env` as `STRIPE_WEBHOOK_SECRET`, then restart the server.

### 5. First login

Go to http://localhost:3000/admin and log in with the credentials you set in `.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).

The database is automatically created and seeded with sample products on first run.

---

## 💳 Stripe Test Cards

Use these card numbers on the Stripe-hosted checkout page (any future expiry, any CVC):

| Card | Number |
|------|--------|
| Visa (success) | `4242 4242 4242 4242` |
| Requires auth | `4000 0025 0000 3155` |
| Declined | `4000 0000 0000 9995` |

---

## 📁 Project Structure

```
ecommerce/
├── server.js              # Express app entry point
├── db.js                  # SQLite setup, schema, seed data, helpers
├── .env.example           # Environment variable template
├── package.json
│
├── routes/
│   ├── products.js        # GET /api/products, /api/products/:slug
│   ├── cart.js            # GET/POST/PATCH/DELETE /api/cart
│   ├── checkout.js        # POST /api/checkout/session, webhook
│   ├── orders.js          # GET /api/orders/lookup (customer tracking)
│   └── admin.js           # All /api/admin/* endpoints (auth required)
│
├── public/
│   ├── index.html         # Storefront SPA
│   ├── cart.html          # Cart & checkout page
│   ├── success.html       # Post-payment confirmation
│   ├── orders.html        # Customer order tracking
│   └── admin/
│       └── index.html     # Admin dashboard SPA
│
└── data/                  # Auto-created on first run
    ├── store.db           # SQLite database
    └── sessions.db        # Session storage
```

---

## ⚙️ Admin Dashboard Guide

| Section | What you can do |
|---------|----------------|
| **Dashboard** | View revenue, order counts, low-stock alerts, 30-day sales chart |
| **Orders** | Search/filter orders, update status (pending → processing → shipped → delivered) |
| **Products** | Add/edit/archive products, set price, stock, images, sale badges |
| **Categories** | Create/rename/delete product categories |
| **Settings** | Store name, currency, tax rate, flat shipping fee, free shipping threshold |

---

## 🌐 Deploying to Railway (Free Hosting)

Railway offers a free tier that's perfect for this app.

### Step 1 — Push your code to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
# Create a repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### Step 2 — Create a Railway project

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **New Project → Deploy from GitHub repo**
3. Select your repository

### Step 3 — Set environment variables

In Railway → your service → **Variables**, add all the variables from your `.env`:

```
SESSION_SECRET=your-production-secret
STRIPE_SECRET_KEY=sk_live_...      ← use LIVE keys in production
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...    ← from step 4 below
STORE_URL=https://YOUR-APP.railway.app
ADMIN_EMAIL=admin@yourstore.com
ADMIN_PASSWORD=a-strong-password
STORE_NAME=My Store
NODE_ENV=production
```

> ⚠️ Use your **live** Stripe keys (not test keys) for real payments.

### Step 4 — Set up the production Stripe webhook

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **Add endpoint**
3. Endpoint URL: `https://YOUR-APP.railway.app/api/checkout/webhook`
4. Select event: **checkout.session.completed**
5. Copy the **Signing secret** → paste as `STRIPE_WEBHOOK_SECRET` in Railway variables

### Step 5 — Deploy

Railway auto-deploys on every push to `main`. Your store will be live at the Railway-assigned URL (e.g., `https://mystore-production.up.railway.app`).

---

## 🔒 Security Notes

- Passwords are hashed with **bcryptjs** (never stored in plain text)
- Sessions use **httpOnly cookies** (not accessible to JavaScript)
- `secure: true` on cookies is enforced automatically in production (`NODE_ENV=production`)
- Stripe webhook signatures are verified — fake events are rejected
- Admin routes require session authentication; unauthenticated requests return 401
- SQL queries use **prepared statements** (no SQL injection risk)

---

## 🛠️ Customizing Your Store

**Change the store name/logo:**
Edit the `STORE_NAME` env variable and update the `.logo` text in `public/index.html`.

**Add/edit products:**
Use the admin dashboard at `/admin` → Products.

**Change colors:**
The storefront uses CSS variables at the top of each HTML file's `<style>` block. Edit `--accent` (blue, default `#2563eb`) to match your brand.

**Add more pages:**
Create new `.html` files in `public/` — the Express static middleware will serve them automatically.

---

## 🐛 Troubleshooting

| Problem | Fix |
|---------|-----|
| `Cannot find module 'better-sqlite3'` | Run `npm install` again; may need build tools: `npm install --build-from-source` |
| Stripe webhook events not arriving | Make sure `stripe listen` is running and `STRIPE_WEBHOOK_SECRET` matches |
| Admin login says "Invalid credentials" | Check `ADMIN_EMAIL`/`ADMIN_PASSWORD` in `.env` match what you type |
| Orders not created after payment | Check webhook is forwarding; look at terminal output from `stripe listen` |
| Port 3000 already in use | Change `PORT=3001` in `.env` |

---

## 📄 License

MIT — free to use and modify for personal or commercial projects.
