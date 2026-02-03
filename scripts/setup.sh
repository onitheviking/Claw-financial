#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"

echo "=== Claw Financial Setup ==="
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
  echo "Error: Node.js is required (v18+). Install from https://nodejs.org"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "Error: Node.js v18+ required (found v$(node -v))"
  exit 1
fi

# Install dependencies
echo "Installing dependencies..."
cd "$PROJECT_DIR"
npm install

# Create .env if it doesn't exist
if [ ! -f "$ENV_FILE" ]; then
  cp "$PROJECT_DIR/.env.example" "$ENV_FILE"
  echo "Created .env from .env.example"
fi

# Generate encryption key if not set
if grep -q "^CLAW_FINANCIAL_ENCRYPTION_KEY=$" "$ENV_FILE" 2>/dev/null; then
  KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/^CLAW_FINANCIAL_ENCRYPTION_KEY=$/CLAW_FINANCIAL_ENCRYPTION_KEY=$KEY/" "$ENV_FILE"
  else
    sed -i "s/^CLAW_FINANCIAL_ENCRYPTION_KEY=$/CLAW_FINANCIAL_ENCRYPTION_KEY=$KEY/" "$ENV_FILE"
  fi
  echo "Generated encryption key"
fi

# Check for Plaid credentials
if grep -q "your_client_id_here" "$ENV_FILE" 2>/dev/null; then
  echo ""
  echo "Next steps:"
  echo "  1. Get your Plaid API keys at https://dashboard.plaid.com"
  echo "  2. Edit $ENV_FILE and set PLAID_CLIENT_ID and PLAID_SECRET"
  echo "  3. Run: npm run build"
  echo "  4. Run: npm start  (or: claw-financial dashboard)"
  echo ""
  echo "Using Sandbox mode for testing? Plaid Sandbox is free and uses fake data."
else
  echo "Plaid credentials found."
fi

# Build
echo ""
echo "Building..."
npm run build

echo ""
echo "Setup complete."

# Check for plaid-cli
if command -v plaid-cli &> /dev/null; then
  echo ""
  echo "Detected plaid-cli — this skill is compatible with the community"
  echo "plaid skill. Both share the same PLAID_CLIENT_ID / PLAID_SECRET."
else
  echo ""
  echo "Tip: Install plaid-cli (Go) for additional CLI capabilities:"
  echo "  go install github.com/jverdi/plaid-cli@0.0.2"
fi

echo ""
echo "To start the dashboard: npm start"
echo "To install as an OpenClaw skill: copy this folder to ~/.openclaw/skills/"
