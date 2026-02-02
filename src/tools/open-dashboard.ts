#!/usr/bin/env ts-node
/**
 * Tool: open-dashboard
 * Starts the Claw Financial dashboard server and opens it in the user's browser.
 * This gives the user a visual UI to link/manage bank accounts via Plaid.
 */
import { startServer } from "../server";
import { CONFIG, validateConfig } from "../config";

async function main() {
  const errors = validateConfig();
  if (errors.length > 0) {
    console.error("Configuration errors:");
    errors.forEach((e) => console.error("  - " + e));
    process.exit(1);
  }

  await startServer();
  const url = `http://${CONFIG.server.host}:${CONFIG.server.port}`;
  console.log(`Dashboard running at ${url}`);

  // Dynamic import for ESM-only 'open' package
  const open = (await import("open")).default;
  await open(url);

  console.log("Dashboard opened in browser. Press Ctrl+C to stop.");
}

main().catch((err) => {
  console.error("Failed to start dashboard:", err.message);
  process.exit(1);
});
