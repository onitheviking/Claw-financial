# Claw Financial

Plaid integration plugin for [OpenClaw](https://openclaw.ai) — connect your bank accounts and let your AI analyze your financial transactions.

This plugin provides a **local web dashboard** for linking and managing bank accounts via Plaid, plus CLI tools that your OpenClaw AI can invoke to fetch balances, transactions, and spending summaries.

## What it does

- **Web Dashboard** — a local UI at `http://127.0.0.1:9876` to link bank accounts via Plaid Link, view connected institutions, sync transactions, and remove accounts
- **AI Tools** — CLI commands the OpenClaw agent invokes to fetch balances, transactions, and spending analysis in AI-friendly formats
- **Encrypted Storage** — access tokens encrypted at rest with AES-256-GCM; no financial data stored locally
- **Ecosystem Compatible** — uses the same Plaid credentials as the community [`plaid` skill](https://github.com/openclaw/skills/tree/main/skills/jverdi/plaid/SKILL.md) and works alongside [`just-fucking-cancel`](https://github.com/openclaw/skills/tree/main/skills/chipagosfinest/just-fucking-cancel/SKILL.md) for subscription auditing

## Quick Start

### 1. Get Plaid API keys

Sign up at [dashboard.plaid.com](https://dashboard.plaid.com). Sandbox mode is free and uses simulated bank data for testing.

### 2. Install

```bash
git clone https://github.com/laura-flugga/Claw-financial.git
cd Claw-financial
npm run setup
```

The setup script will install dependencies, generate an encryption key, and build the project. Edit `.env` with your Plaid credentials.

### 3. Install as OpenClaw skill

Copy or symlink into your skills directory:

```bash
# Workspace-level (single agent)
cp -r . /path/to/your/workspace/skills/claw-financial

# Or user-level (all agents)
cp -r . ~/.openclaw/skills/claw-financial
```

Or install via ClawHub if published:
```bash
npx clawhub@latest install claw-financial
```

### 4. Configure in OpenClaw

Add to `~/.openclaw/openclaw.json`:

```json5
{
  skills: {
    entries: {
      "claw-financial": {
        enabled: true,
        env: {
          PLAID_CLIENT_ID: "your_client_id",
          PLAID_SECRET: "your_secret",
          PLAID_ENVIRONMENT: "sandbox",
          CLAW_FINANCIAL_ENCRYPTION_KEY: "your_generated_key"
        }
      }
    }
  }
}
```

## Usage

### Dashboard

Start the account management dashboard:

```bash
npm start
# or
claw-financial dashboard
```

This opens a web UI where you can link bank accounts, view connections, and manage them visually.

### CLI Tools

```bash
claw-financial accounts              # List connected accounts
claw-financial balances <id>         # Get account balances
claw-financial transactions <id>     # Get transactions
claw-financial transactions <id> --summary   # Spending breakdown
claw-financial remove <id>           # Remove an account
```

Add `--json` to any command for structured JSON output.

### Talk to your AI

Once accounts are linked, ask your OpenClaw AI things like:

- "What are my account balances?"
- "Show me my transactions for Chase"
- "How much did I spend on food this month?"
- "What are my biggest recurring charges?"
- "Give me a spending breakdown by category"

## Companion Skills

This plugin works well alongside other finance skills from the [awesome-openclaw-skills](https://github.com/VoltAgent/awesome-openclaw-skills#finance) collection:

| Skill | What it adds |
|-------|-------------|
| [`plaid`](https://github.com/openclaw/skills/tree/main/skills/jverdi/plaid/SKILL.md) | Terminal-based `plaid-cli` for quick queries — shares the same credentials |
| [`just-fucking-cancel`](https://github.com/openclaw/skills/tree/main/skills/chipagosfinest/just-fucking-cancel/SKILL.md) | Subscription detection and cancellation from your Plaid transaction data |
| [`expense-tracker-pro`](https://github.com/openclaw/skills/tree/main/skills/jhillin8/expense-tracker-pro/SKILL.md) | Manual expense logging via natural language |
| [`tax-professional`](https://github.com/openclaw/skills/tree/main/skills/scottfo/tax-professional/SKILL.md) | Tax advice and deduction optimization |
| [`ynab`](https://github.com/openclaw/skills/tree/main/skills/obviyus/ynab/SKILL.md) | YNAB budget management integration |

## Architecture

```
Claw-financial/
├── SKILL.md                  # OpenClaw skill definition (AI reads this)
├── openclaw.plugin.json      # Plugin manifest
├── bin/claw-financial        # CLI entry point
├── src/
│   ├── server.ts             # Express server (dashboard + API)
│   ├── plaid-client.ts       # Plaid SDK wrapper
│   ├── token-store.ts        # Encrypted token storage (SQLite)
│   ├── config.ts             # Configuration (plaid-cli compatible)
│   ├── views/
│   │   └── dashboard.html    # Account management UI
│   ├── public/
│   │   ├── css/dashboard.css # Dashboard styles
│   │   └── js/dashboard.js   # Dashboard client-side logic
│   ├── tools/                # OpenClaw tool scripts
│   │   ├── open-dashboard.ts
│   │   ├── get-accounts.ts
│   │   ├── get-balances.ts
│   │   ├── get-transactions.ts
│   │   └── remove-account.ts
│   └── utils/
│       ├── formatter.ts      # AI-friendly output formatting
│       └── crypto.ts         # AES-256-GCM encryption
├── scripts/setup.sh          # First-run setup
└── test/
```

## Security

- Access tokens are encrypted at rest using AES-256-GCM with PBKDF2 key derivation
- Credentials are never hardcoded — injected via environment variables or OpenClaw skill config
- The dashboard binds to `127.0.0.1` only (not exposed to the network)
- No financial data is stored locally — transactions are fetched in real-time from Plaid
- Read-only Plaid products only (Transactions, Balance) — no payment initiation
- Compatible with OpenClaw's Docker sandbox mode

## Forking

This plugin is designed to be forked. To use it on your own:

1. Fork this repo
2. Get your own [Plaid API keys](https://dashboard.plaid.com)
3. Run `npm run setup`
4. Drop into your OpenClaw skills directory

No code changes needed — just your own credentials.

## License

GPL-3.0 — see [LICENSE](LICENSE).
