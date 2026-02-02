#!/usr/bin/env ts-node
/**
 * Tool: remove-account
 * Disconnects a linked bank account from Plaid and removes stored data.
 * Usage: remove-account <account-id>
 */
import {
  getAccessToken,
  getAccount,
  removeAccount as removeStoredAccount,
} from "../token-store";
import { removeItem } from "../plaid-client";
import "../config";

async function main() {
  const accountId = process.argv[2];
  if (!accountId) {
    console.error(
      "Usage: remove-account <account-id>\nRun get-accounts to see available account IDs.",
    );
    process.exit(1);
  }

  const account = getAccount(accountId);
  if (!account) {
    console.error(`Account ${accountId} not found.`);
    process.exit(1);
  }

  // Remove from Plaid
  try {
    const accessToken = getAccessToken(accountId);
    await removeItem(accessToken);
  } catch {
    // Continue even if Plaid removal fails (token may already be invalid)
  }

  removeStoredAccount(accountId);
  console.log(`Removed ${account.institution_name} (${accountId}).`);
}

main().catch((err) => {
  console.error("Error removing account:", err.message);
  process.exit(1);
});
