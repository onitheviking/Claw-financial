#!/usr/bin/env ts-node
/**
 * Tool: get-transactions
 * Fetches and syncs transactions for a connected account.
 * Usage: get-transactions <account-id> [--json] [--summary]
 */
import { getAccessToken, getAccount, updateSyncCursor } from "../token-store";
import { syncTransactions } from "../plaid-client";
import {
  formatTransactionsTable,
  summarizeTransactions,
} from "../utils/formatter";
import "../config";

async function main() {
  const accountId = process.argv[2];
  if (!accountId) {
    console.error(
      "Usage: get-transactions <account-id> [--json] [--summary]\nRun get-accounts to see available account IDs.",
    );
    process.exit(1);
  }

  const account = getAccount(accountId);
  if (!account) {
    console.error(`Account ${accountId} not found.`);
    process.exit(1);
  }

  const accessToken = getAccessToken(accountId);
  const result = await syncTransactions(accessToken, account.cursor);
  updateSyncCursor(accountId, result.cursor);

  const transactions = result.added;
  const wantJson = process.argv.includes("--json");
  const wantSummary = process.argv.includes("--summary");

  if (wantSummary) {
    const summary = summarizeTransactions(transactions);
    if (wantJson) {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      const s = summary as any;
      console.log(`Transaction Summary for ${account.institution_name}:`);
      console.log(`  Total Spent:  $${s.total_spent.toFixed(2)}`);
      console.log(`  Total Income: $${s.total_income.toFixed(2)}`);
      console.log(`  Net:          $${s.net.toFixed(2)}`);
      console.log(`  Transactions: ${s.transaction_count}`);
      if (s.spending_by_category.length > 0) {
        console.log(`\n  Spending by Category:`);
        for (const cat of s.spending_by_category) {
          console.log(`    ${cat.category}: $${cat.amount.toFixed(2)}`);
        }
      }
    }
  } else if (wantJson) {
    console.log(
      JSON.stringify(
        {
          institution: account.institution_name,
          count: transactions.length,
          transactions: transactions.map((tx: any) => ({
            date: tx.date,
            merchant: tx.merchant_name || tx.name,
            amount: tx.amount,
            category: tx.personal_finance_category?.primary || tx.category?.[0],
            pending: tx.pending,
          })),
        },
        null,
        2,
      ),
    );
  } else {
    console.log(
      `Transactions for ${account.institution_name} (${transactions.length}):\n`,
    );
    console.log(formatTransactionsTable(transactions));
  }
}

main().catch((err) => {
  console.error("Error fetching transactions:", err.message);
  process.exit(1);
});
