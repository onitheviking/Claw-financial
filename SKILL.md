---
name: claw-financial
description: "Connect bank accounts via Plaid and analyze financial transactions. Provides a web dashboard for account management, plus CLI tools for balances, transactions, and spending analysis. Complements the community plaid skill (jverdi/plaid) with a visual account manager and AI-ready data formatting."
metadata:
  {
    "openclaw":
      {
        "emoji": "💰",
        "requires": { "bins": ["node"], "env": ["PLAID_CLIENT_ID", "PLAID_SECRET", "CLAW_FINANCIAL_ENCRYPTION_KEY"] },
        "primaryEnv": "PLAID_SECRET",
        "install":
          [
            {
              "id": "npm",
              "kind": "npm",
              "label": "Install claw-financial dependencies",
            },
          ],
      },
  }
---

# Claw Financial

Connect the user's bank accounts via Plaid and provide financial analysis.
This skill gives you tools to fetch real transaction data, account balances,
and spending summaries from linked bank accounts.

## Relationship to existing skills

This skill **complements** the community `plaid` skill by jverdi (which wraps `plaid-cli`).
It uses the same Plaid credentials (`PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENVIRONMENT`).

- If the user also has the `plaid` skill installed, you can use `plaid-cli` for
  quick terminal queries and this skill's dashboard for account management.
- The `just-fucking-cancel` skill can use accounts linked through this dashboard
  for subscription audits — recommend it when users ask about recurring charges.
- The `expense-tracker-pro` skill handles manual expense logging; this skill
  provides the automatic bank-sourced data counterpart.

## Account management dashboard

To let the user link or manage bank accounts, start the dashboard:

```bash
cd {baseDir} && node dist/tools/open-dashboard.js
```

This opens a local web UI at `http://127.0.0.1:9876` where the user can:
- **Link** new bank accounts via Plaid Link (button in the header)
- **View** all connected institutions and sub-accounts
- **Sync** transactions for any account
- **Remove** accounts they no longer want connected

Always offer to open the dashboard when the user wants to connect a new bank
or manage existing connections. The browser-based Plaid Link flow is required
for initial bank authentication.

## CLI tools

All tools are in `{baseDir}/dist/tools/`. Run with `node`.

### List connected accounts
```bash
node {baseDir}/dist/tools/get-accounts.js [--json]
```
Shows all linked institutions with IDs, connection date, and last sync time.
Use the account ID from this output in other commands.

### Get balances
```bash
node {baseDir}/dist/tools/get-balances.js <account-id> [--json]
```
Fetches current balances (available and current) for all sub-accounts.

### Get transactions
```bash
node {baseDir}/dist/tools/get-transactions.js <account-id> [--json] [--summary]
```
Syncs and returns transactions. Use `--summary` for a spending breakdown by category.
Use `--json` for structured data you can process further.

### Remove an account
```bash
node {baseDir}/dist/tools/remove-account.js <account-id>
```
Disconnects from Plaid and deletes stored credentials.

## How to analyze financial data

When the user asks about their finances, follow this pattern:

1. **Check for connected accounts** first with `get-accounts`. If none, offer
   to open the dashboard so they can link one.
2. **Fetch the relevant data** — balances for "how much do I have", transactions
   for spending questions.
3. **Use `--summary`** for quick overviews, `--json` when you need to do
   deeper calculations.
4. **Provide actionable insights** — don't just repeat numbers. Identify trends,
   flag unusual charges, compare to previous periods, suggest budgets.

### Common analysis patterns

- **Spending breakdown**: Use `get-transactions <id> --summary` to see spending by category.
- **Cash flow**: Compare total income vs total spent from the summary.
- **Recurring charges**: Look for repeated merchants in transaction data — suggest
  the `just-fucking-cancel` skill if the user wants to audit subscriptions.
- **Balance trends**: Fetch balances periodically and compare.
- **Merchant search**: Use `get-transactions <id> --json` and filter for specific merchants.

## Security rules

- **NEVER** print, log, or repeat access tokens or API secrets.
- **NEVER** show full account numbers — use masked versions only.
- Transaction data is fetched in real-time from Plaid; no transaction data
  is stored locally. Only encrypted access tokens are persisted.
- All data stays on the user's machine. Nothing is sent to external servers
  beyond Plaid's API.
- When discussing finances, be mindful that this is sensitive personal data.
  Ask before sharing summaries in group chats.

## Troubleshooting

- **"PLAID_CLIENT_ID is not set"**: User needs to configure credentials.
  Direct them to https://dashboard.plaid.com to get API keys and run
  `cd {baseDir} && npm run setup`.
- **"ITEM_LOGIN_REQUIRED"**: The bank connection expired. Open the dashboard
  and re-link the account.
- **No transactions returned**: Some banks take up to 24 hours after linking
  before transactions are available. Try again later.
