#!/usr/bin/env ts-node
/**
 * Tool: get-balances
 * Fetches current balances for a connected account.
 * Usage: get-balances <account-id> [--json]
 */
import { getAccessToken, getAccount } from "../token-store";
import { getBalances } from "../plaid-client";
import { formatBalances } from "../utils/formatter";
import "../config";

async function main() {
  const accountId = process.argv[2];
  if (!accountId) {
    console.error(
      "Usage: get-balances <account-id> [--json]\nRun get-accounts to see available account IDs.",
    );
    process.exit(1);
  }

  const account = getAccount(accountId);
  if (!account) {
    console.error(`Account ${accountId} not found.`);
    process.exit(1);
  }

  const accessToken = getAccessToken(accountId);
  const accounts = await getBalances(accessToken);

  const data = accounts.map((a) => ({
    name: a.name,
    type: a.type,
    subtype: a.subtype,
    balances: {
      current: a.balances.current,
      available: a.balances.available,
    },
  }));

  if (process.argv.includes("--json")) {
    console.log(
      JSON.stringify(
        { institution: account.institution_name, accounts: data },
        null,
        2,
      ),
    );
  } else {
    console.log(`Balances for ${account.institution_name}:\n`);
    console.log(formatBalances(data));
  }
}

main().catch((err) => {
  console.error("Error fetching balances:", err.message);
  process.exit(1);
});
