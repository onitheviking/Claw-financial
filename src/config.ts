import path from "path";
import os from "os";
import { execSync } from "child_process";

// Uses the same env vars as the community plaid-cli skill (jverdi/plaid)
// so users who already have plaid-cli configured get zero-friction setup.
// PLAID_ENVIRONMENT is the plaid-cli convention; PLAID_ENV is our alias.
export const CONFIG = {
  plaid: {
    clientId: process.env.PLAID_CLIENT_ID || "",
    secret: process.env.PLAID_SECRET || "",
    env: (process.env.PLAID_ENVIRONMENT ||
      process.env.PLAID_ENV ||
      "sandbox") as "sandbox" | "production",
    products: ["transactions"] as string[],
    countryCodes: (
      process.env.PLAID_COUNTRIES || "US"
    ).split(",") as string[],
    language: process.env.PLAID_LANGUAGE || "en",
  },
  server: {
    port: parseInt(process.env.CLAW_FINANCIAL_PORT || "9876", 10),
    host: "127.0.0.1",
  },
  storage: {
    dir:
      process.env.CLAW_FINANCIAL_DATA_DIR ||
      path.join(os.homedir(), ".openclaw", "claw-financial"),
    dbFile: "accounts.db",
  },
  encryptionKey: process.env.CLAW_FINANCIAL_ENCRYPTION_KEY || "",
  plaidCliBin: resolveCliBin(),
};

function resolveCliBin(): string | null {
  try {
    execSync("command -v plaid-cli", { stdio: "pipe" });
    return "plaid-cli";
  } catch {
    return null;
  }
}

export function validateConfig(): string[] {
  const errors: string[] = [];
  if (!CONFIG.plaid.clientId) errors.push("PLAID_CLIENT_ID is not set");
  if (!CONFIG.plaid.secret) errors.push("PLAID_SECRET is not set");
  if (!CONFIG.encryptionKey)
    errors.push(
      "CLAW_FINANCIAL_ENCRYPTION_KEY is not set — run `npm run setup` to generate one",
    );
  return errors;
}
