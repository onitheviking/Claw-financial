import crypto from "crypto";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { CONFIG } from "./config";
import { encrypt, decrypt } from "./utils/crypto";

export interface StoredAccount {
  id: string;
  item_id: string;
  institution_id: string;
  institution_name: string;
  account_ids: string;
  created_at: string;
  last_synced: string | null;
  cursor: string | null;
}

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;
  // Create storage directory with restricted permissions (owner-only)
  fs.mkdirSync(CONFIG.storage.dir, { recursive: true, mode: 0o700 });
  const dbPath = path.join(CONFIG.storage.dir, CONFIG.storage.dbFile);
  const dbExists = fs.existsSync(dbPath);
  db = new Database(dbPath);
  // Set file permissions to owner-only read/write if newly created
  if (!dbExists) {
    fs.chmodSync(dbPath, 0o600);
  }
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      item_id TEXT UNIQUE NOT NULL,
      access_token_enc TEXT NOT NULL,
      institution_id TEXT NOT NULL,
      institution_name TEXT NOT NULL,
      account_ids TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_synced TEXT,
      cursor TEXT
    );
  `);
  return db;
}

export function storeAccount(
  itemId: string,
  accessToken: string,
  institutionId: string,
  institutionName: string,
  accountIds: string[],
): StoredAccount {
  const database = getDb();
  const id = `acct_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
  const accessTokenEnc = encrypt(accessToken, CONFIG.encryptionKey);
  database
    .prepare(
      `INSERT INTO accounts (id, item_id, access_token_enc, institution_id, institution_name, account_ids)
     VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      itemId,
      accessTokenEnc,
      institutionId,
      institutionName,
      JSON.stringify(accountIds),
    );
  return {
    id,
    item_id: itemId,
    institution_id: institutionId,
    institution_name: institutionName,
    account_ids: JSON.stringify(accountIds),
    created_at: new Date().toISOString(),
    last_synced: null,
    cursor: null,
  };
}

export function getAccessToken(accountId: string): string {
  const database = getDb();
  const row = database
    .prepare("SELECT access_token_enc FROM accounts WHERE id = ?")
    .get(accountId) as { access_token_enc: string } | undefined;
  if (!row) throw new Error("Account not found");
  try {
    return decrypt(row.access_token_enc, CONFIG.encryptionKey);
  } catch {
    throw new Error(
      "Failed to decrypt access token. The encryption key may have changed — re-link the account.",
    );
  }
}

export function listAccounts(): StoredAccount[] {
  const database = getDb();
  return database
    .prepare(
      "SELECT id, item_id, institution_id, institution_name, account_ids, created_at, last_synced, cursor FROM accounts ORDER BY created_at DESC",
    )
    .all() as StoredAccount[];
}

export function getAccount(accountId: string): StoredAccount | undefined {
  const database = getDb();
  return database
    .prepare(
      "SELECT id, item_id, institution_id, institution_name, account_ids, created_at, last_synced, cursor FROM accounts WHERE id = ?",
    )
    .get(accountId) as StoredAccount | undefined;
}

export function updateSyncCursor(accountId: string, cursor: string): void {
  const database = getDb();
  database
    .prepare(
      "UPDATE accounts SET cursor = ?, last_synced = datetime('now') WHERE id = ?",
    )
    .run(cursor, accountId);
}

export function removeAccount(accountId: string): boolean {
  const database = getDb();
  const result = database
    .prepare("DELETE FROM accounts WHERE id = ?")
    .run(accountId);
  return result.changes > 0;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
