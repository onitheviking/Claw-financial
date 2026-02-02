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

// ---- Status ----

app.get("/api/status", (_req, res) => {
  const errors = validateConfig();
  res.json({
    ok: errors.length === 0,
    environment: CONFIG.plaid.env,
    errors,
  });
});

// ---- Dashboard ----

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "src", "views", "dashboard.html"));
});

// ---- Plaid Link ----

app.post("/api/link/token", async (_req, res) => {
  try {
    const userId = `claw-user-${Date.now()}`;
    const linkToken = await createLinkToken(userId);
    res.json({ link_token: linkToken });
  } catch (err: any) {
    console.error("Link token error:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to create link token" });
  }
});

app.post("/api/link/exchange", async (req, res) => {
  try {
    const { public_token, institution, accounts: accountIds } = req.body;
    if (!public_token || !institution?.id || !institution?.name) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const { accessToken, itemId } = await exchangePublicToken(public_token);
    const stored = storeAccount(
      itemId,
      accessToken,
      institution.id,
      institution.name,
      accountIds || [],
    );

    res.json({ account: stored });
  } catch (err: any) {
    console.error("Token exchange error:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to exchange token" });
  }
});

// ---- Accounts ----

app.get("/api/accounts", (_req, res) => {
  try {
    const accounts = listAccounts();
    res.json({ accounts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/accounts/:id", async (req, res) => {
  try {
    const account = getAccount(req.params.id);
    if (!account) {
      res.status(404).json({ error: "Account not found" });
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
    console.error("Get account error:", err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/accounts/:id", async (req, res) => {
  try {
    const account = getAccount(req.params.id);
    if (!account) {
      res.status(404).json({ error: "Account not found" });
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
    res.status(500).json({ error: err.message });
  }
});

// ---- Balances ----

app.get("/api/accounts/:id/balances", async (req, res) => {
  try {
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
    console.error("Balance error:", err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---- Transactions ----

app.post("/api/accounts/:id/sync", async (req, res) => {
  try {
    const account = getAccount(req.params.id);
    if (!account) {
      res.status(404).json({ error: "Account not found" });
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
    console.error("Sync error:", err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/accounts/:id/transactions", async (req, res) => {
  try {
    const account = getAccount(req.params.id);
    if (!account) {
      res.status(404).json({ error: "Account not found" });
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
    console.error("Transactions error:", err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---- Start ----

let server: ReturnType<typeof app.listen> | null = null;

export function startServer(): Promise<void> {
  return new Promise((resolve) => {
    server = app.listen(CONFIG.server.port, CONFIG.server.host, () => {
      console.log(
        `Claw Financial dashboard: http://${CONFIG.server.host}:${CONFIG.server.port}`,
      );
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
