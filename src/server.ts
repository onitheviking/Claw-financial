import crypto from "crypto";
import express from "express";
import path from "path";
import { CONFIG, validateConfig } from "./config";
import {
  createLinkToken,
  exchangePublicToken,
  getAccounts as getPlaidAccounts,
  getBalances as getPlaidBalances,
  syncTransactions,
  removeItem,
} from "./plaid-client";
import {
  storeAccount,
  listAccounts,
  getAccount,
  getAccessToken,
  updateSyncCursor,
  removeAccount as removeStoredAccount,
  closeDb,
} from "./token-store";

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "src", "public")));

// ---- Security helpers ----

// Redact Plaid API responses before logging — err.response.data may
// contain access tokens, request IDs, or account numbers.
function safeLogError(label: string, err: any): void {
  const plaidCode = err.response?.data?.error_code;
  const plaidType = err.response?.data?.error_type;
  if (plaidCode) {
    console.error(`${label}: [${plaidType}] ${plaidCode}`);
  } else {
    console.error(`${label}: ${err.code || "UNKNOWN"}`);
  }
}

// Generic error response — never leak internal messages to the client.
function errorResponse(
  res: express.Response,
  status: number,
  publicMessage: string,
): void {
  res.status(status).json({ error: publicMessage });
}

// Bearer token authentication middleware.
// The token is the first 32 chars of the HMAC-SHA256 of the encryption key,
// so users don't need to manage a separate auth secret. It's derived
// deterministically and only valid for the lifetime of the encryption key.
let authToken: string | null = null;

function deriveAuthToken(): string {
  if (authToken) return authToken;
  if (!CONFIG.encryptionKey) return "";
  authToken = crypto
    .createHmac("sha256", CONFIG.encryptionKey)
    .update("claw-financial-dashboard-auth")
    .digest("hex")
    .slice(0, 32);
  return authToken;
}

function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  const token = deriveAuthToken();
  // If no encryption key is configured, auth is disabled (setup mode)
  if (!token) {
    next();
    return;
  }

  const header = req.headers.authorization;
  const query = req.query.token as string | undefined;
  const provided = header?.replace(/^Bearer\s+/i, "") || query;

  if (
    !provided ||
    !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(token))
  ) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// CSP and security headers
app.use((_req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' https://cdn.plaid.com 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-src https://cdn.plaid.com",
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

// Account ID format validation
const ACCOUNT_ID_RE = /^acct_[a-zA-Z0-9_]{10,50}$/;

function isValidAccountId(id: string): boolean {
  return ACCOUNT_ID_RE.test(id);
}

// ---- Status (unauthenticated — needed for dashboard boot) ----

app.get("/api/status", (_req, res) => {
  const errors = validateConfig();
  res.json({
    ok: errors.length === 0,
    environment: CONFIG.plaid.env,
    errors,
    auth_required: !!deriveAuthToken(),
  });
});

// ---- Auth token check (for dashboard login) ----

app.get("/api/auth/check", requireAuth, (_req, res) => {
  res.json({ ok: true });
});

// ---- Dashboard ----

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "src", "views", "dashboard.html"));
});

// ---- Plaid Link ----

app.post("/api/link/token", requireAuth, async (_req, res) => {
  try {
    const userId = `claw-user-${Date.now()}`;
    const linkToken = await createLinkToken(userId);
    res.json({ link_token: linkToken });
  } catch (err: any) {
    safeLogError("Link token error", err);
    errorResponse(res, 500, "Failed to create link token");
  }
});

app.post("/api/link/exchange", requireAuth, async (req, res) => {
  try {
    const { public_token, institution, accounts: accountIds } = req.body;
    if (
      typeof public_token !== "string" ||
      !institution?.id ||
      typeof institution?.name !== "string"
    ) {
      errorResponse(res, 400, "Missing required fields");
      return;
    }

    const { accessToken, itemId } = await exchangePublicToken(public_token);
    const stored = storeAccount(
      itemId,
      accessToken,
      institution.id,
      institution.name,
      Array.isArray(accountIds) ? accountIds : [],
    );

    res.json({ account: stored });
  } catch (err: any) {
    safeLogError("Token exchange error", err);
    errorResponse(res, 500, "Failed to exchange token");
  }
});

// ---- Accounts ----

app.get("/api/accounts", requireAuth, (_req, res) => {
  try {
    const accounts = listAccounts();
    res.json({ accounts });
  } catch (err: any) {
    safeLogError("List accounts error", err);
    errorResponse(res, 500, "Failed to list accounts");
  }
});

app.get("/api/accounts/:id", requireAuth, async (req, res) => {
  try {
    if (!isValidAccountId(req.params.id)) {
      errorResponse(res, 400, "Invalid account ID format");
      return;
    }

    const account = getAccount(req.params.id);
    if (!account) {
      errorResponse(res, 404, "Account not found");
      return;
    }

    const accessToken = getAccessToken(req.params.id);
    const plaidAccounts = await getPlaidAccounts(accessToken);

    res.json({
      account,
      plaid_accounts: plaidAccounts.map((a) => ({
        id: a.account_id,
        name: a.name,
        official_name: a.official_name,
        type: a.type,
        subtype: a.subtype,
        mask: a.mask,
      })),
    });
  } catch (err: any) {
    safeLogError("Get account error", err);
    errorResponse(res, 500, "Failed to retrieve account");
  }
});

app.delete("/api/accounts/:id", requireAuth, async (req, res) => {
  try {
    if (!isValidAccountId(req.params.id)) {
      errorResponse(res, 400, "Invalid account ID format");
      return;
    }

    const account = getAccount(req.params.id);
    if (!account) {
      errorResponse(res, 404, "Account not found");
      return;
    }

    // Remove from Plaid
    try {
      const accessToken = getAccessToken(req.params.id);
      await removeItem(accessToken);
    } catch {
      // Continue even if Plaid removal fails (token may already be invalid)
    }

    removeStoredAccount(req.params.id);
    res.json({ removed: true });
  } catch (err: any) {
    safeLogError("Remove account error", err);
    errorResponse(res, 500, "Failed to remove account");
  }
});

// ---- Balances ----

app.get("/api/accounts/:id/balances", requireAuth, async (req, res) => {
  try {
    if (!isValidAccountId(req.params.id)) {
      errorResponse(res, 400, "Invalid account ID format");
      return;
    }

    const account = getAccount(req.params.id);
    if (!account) {
      errorResponse(res, 404, "Account not found");
      return;
    }

    const accessToken = getAccessToken(req.params.id);
    const accounts = await getPlaidBalances(accessToken);
    res.json({
      accounts: accounts.map((a) => ({
        name: a.name,
        type: a.type,
        subtype: a.subtype,
        balances: {
          current: a.balances.current,
          available: a.balances.available,
          limit: a.balances.limit,
        },
      })),
    });
  } catch (err: any) {
    safeLogError("Balance error", err);
    errorResponse(res, 500, "Failed to fetch balances");
  }
});

// ---- Transactions ----

app.post("/api/accounts/:id/sync", requireAuth, async (req, res) => {
  try {
    if (!isValidAccountId(req.params.id)) {
      errorResponse(res, 400, "Invalid account ID format");
      return;
    }

    const account = getAccount(req.params.id);
    if (!account) {
      errorResponse(res, 404, "Account not found");
      return;
    }

    const accessToken = getAccessToken(req.params.id);
    const result = await syncTransactions(accessToken, account.cursor);
    updateSyncCursor(req.params.id, result.cursor);

    res.json({
      added: result.added.length,
      modified: result.modified.length,
      removed: result.removed.length,
      transactions: result.added,
    });
  } catch (err: any) {
    safeLogError("Sync error", err);
    errorResponse(res, 500, "Failed to sync transactions");
  }
});

app.get("/api/accounts/:id/transactions", requireAuth, async (req, res) => {
  try {
    if (!isValidAccountId(req.params.id)) {
      errorResponse(res, 400, "Invalid account ID format");
      return;
    }

    const account = getAccount(req.params.id);
    if (!account) {
      errorResponse(res, 404, "Account not found");
      return;
    }

    const accessToken = getAccessToken(req.params.id);
    const result = await syncTransactions(accessToken, account.cursor);

    if (result.cursor !== account.cursor) {
      updateSyncCursor(req.params.id, result.cursor);
    }

    res.json({
      transactions: result.added,
      count: result.added.length,
    });
  } catch (err: any) {
    safeLogError("Transactions error", err);
    errorResponse(res, 500, "Failed to fetch transactions");
  }
});

// ---- Start ----

let server: ReturnType<typeof app.listen> | null = null;

export function startServer(): Promise<void> {
  return new Promise((resolve) => {
    server = app.listen(CONFIG.server.port, CONFIG.server.host, () => {
      const token = deriveAuthToken();
      console.log(
        `Claw Financial dashboard: http://${CONFIG.server.host}:${CONFIG.server.port}`,
      );
      if (token) {
        console.log(`Auth token: ${token}`);
        console.log(
          `Dashboard URL: http://${CONFIG.server.host}:${CONFIG.server.port}?token=${token}`,
        );
      }
      resolve();
    });
  });
}

export function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    closeDb();
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
}

// Run directly
if (require.main === module) {
  const errors = validateConfig();
  if (errors.length > 0) {
    console.warn("Configuration warnings:");
    errors.forEach((e) => console.warn("  - " + e));
    console.warn("The dashboard will start but Plaid features will not work.\n");
  }
  startServer();
}

export { app };
