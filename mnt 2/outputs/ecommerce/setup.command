#!/bin/bash
# ─────────────────────────────────────────────
#  MyStore — Mac Auto Setup Script
#  Double-click this file to set up your store
# ─────────────────────────────────────────────

cd "$(dirname "$0")"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║       MyStore Setup — Starting       ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── Check Node.js ────────────────────────────
if ! command -v node &>/dev/null; then
  echo "❌ Node.js is not installed."
  echo ""
  echo "   Please install it from: https://nodejs.org"
  echo "   Download the LTS version, install it, then"
  echo "   double-click this file again."
  echo ""
  read -p "Press Enter to close..."
  exit 1
fi

echo "✅ Node.js $(node --version) found"

# ── Delete old node_modules if they exist ────
if [ -d node_modules ]; then
  echo "🧹 Removing old node_modules..."
  rm -rf node_modules
fi

# ── Install packages ─────────────────────────
echo "📦 Installing packages (this takes ~1 minute)..."
npm install
if [ $? -ne 0 ]; then
  echo ""
  echo "❌ Installation failed. Please try running:"
  echo "   xcode-select --install"
  echo "   Then double-click setup.command again."
  read -p "Press Enter to close..."
  exit 1
fi
echo "✅ Packages installed successfully"

# ── Create .env if missing ───────────────────
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✅ Created .env file"
else
  echo "✅ .env file already exists"
fi

# ── Launch ───────────────────────────────────
echo ""
echo "╔══════════════════════════════════════╗"
echo "║         Setup Complete! 🎉            ║"
echo "╠══════════════════════════════════════╣"
echo "║  Store:  http://localhost:3000        ║"
echo "║  Admin:  http://localhost:3000/admin  ║"
echo "║                                       ║"
echo "║  Admin login:                         ║"
echo "║    Email:    admin@yourstore.com      ║"
echo "║    Password: changeme123              ║"
echo "║                                       ║"
echo "║  Press Ctrl+C to stop the server      ║"
echo "╚══════════════════════════════════════╝"
echo ""

sleep 2 && open http://localhost:3000 &

node server.js
