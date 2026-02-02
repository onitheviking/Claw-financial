#!/usr/bin/env ts-node
/**
 * Tool: get-accounts
 * Lists all connected bank accounts with their status.
 * Output is formatted for AI consumption.
 */
import { listAccounts } from "../token-store";
import { formatAccountsList } from "../utils/formatter";
import "../config"; // ensure config loads

function main() {
  const accounts = listAccounts();

  if (process.argv.includes("--json")) {
    console.log(
      JSON.stringify(
        {
          count: accounts.length,
          accounts: accounts.map((a) => ({
            id: a.id,
            institution: a.institution_name,
            connected: a.created_at,
            last_synced: a.last_synced,
            sub_accounts: JSON.parse(a.account_ids).length,
          })),
        },
        null,
        2,
      ),
    );
  } else {
    console.log(formatAccountsList(accounts));
  }
}

main();
