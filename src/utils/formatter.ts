import dayjs from "dayjs";

export interface TransactionRow {
  date: string;
  name: string;
  merchant_name: string | null;
  amount: number;
  category: string[];
  account_id: string;
  pending: boolean;
}

export function formatTransactionsTable(
  transactions: TransactionRow[],
): string {
  if (transactions.length === 0) return "No transactions found.";

  const lines: string[] = [];
  lines.push("| Date | Merchant | Amount | Category | Status |");
  lines.push("|------|----------|--------|----------|--------|");

  for (const tx of transactions) {
    const date = dayjs(tx.date).format("YYYY-MM-DD");
    const merchant = tx.merchant_name || tx.name;
    const amount =
      tx.amount < 0
        ? `+$${Math.abs(tx.amount).toFixed(2)}`
        : `-$${tx.amount.toFixed(2)}`;
    const category = tx.category?.join(" > ") || "Uncategorized";
    const status = tx.pending ? "Pending" : "Posted";
    lines.push(`| ${date} | ${merchant} | ${amount} | ${category} | ${status} |`);
  }

  return lines.join("\n");
}

export function formatTransactionsJson(transactions: TransactionRow[]): object {
  return {
    count: transactions.length,
    transactions: transactions.map((tx) => ({
      date: tx.date,
      merchant: tx.merchant_name || tx.name,
      amount: tx.amount,
      category: tx.category,
      pending: tx.pending,
    })),
  };
}

export function formatBalances(
  accounts: Array<{
    name: string;
    type: string;
    subtype: string | null;
    balances: {
      current: number | null;
      available: number | null;
    };
  }>,
): string {
  if (accounts.length === 0) return "No accounts found.";

  const lines: string[] = [];
  lines.push("| Account | Type | Current | Available |");
  lines.push("|---------|------|---------|-----------|");

  for (const acct of accounts) {
    const current =
      acct.balances.current != null
        ? `$${acct.balances.current.toFixed(2)}`
        : "N/A";
    const available =
      acct.balances.available != null
        ? `$${acct.balances.available.toFixed(2)}`
        : "N/A";
    lines.push(
      `| ${acct.name} | ${acct.subtype || acct.type} | ${current} | ${available} |`,
    );
  }

  return lines.join("\n");
}

export function formatAccountsList(
  accounts: Array<{
    id: string;
    institution_name: string;
    created_at: string;
    last_synced: string | null;
  }>,
): string {
  if (accounts.length === 0)
    return "No connected accounts. Use the dashboard to link a bank account.";

  const lines: string[] = [];
  lines.push("| ID | Institution | Connected | Last Synced |");
  lines.push("|----|-------------|-----------|-------------|");

  for (const acct of accounts) {
    const connected = dayjs(acct.created_at).format("YYYY-MM-DD");
    const synced = acct.last_synced
      ? dayjs(acct.last_synced).format("YYYY-MM-DD HH:mm")
      : "Never";
    lines.push(
      `| ${acct.id} | ${acct.institution_name} | ${connected} | ${synced} |`,
    );
  }

  return lines.join("\n");
}

export function summarizeTransactions(
  transactions: TransactionRow[],
): object {
  const totalSpent = transactions
    .filter((tx) => tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0);
  const totalIncome = transactions
    .filter((tx) => tx.amount < 0)
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  const byCategory: Record<string, number> = {};
  for (const tx of transactions.filter((t) => t.amount > 0)) {
    const cat = tx.category?.[0] || "Uncategorized";
    byCategory[cat] = (byCategory[cat] || 0) + tx.amount;
  }

  const sortedCategories = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .map(([category, amount]) => ({
      category,
      amount: Math.round(amount * 100) / 100,
    }));

  return {
    total_spent: Math.round(totalSpent * 100) / 100,
    total_income: Math.round(totalIncome * 100) / 100,
    net: Math.round((totalIncome - totalSpent) * 100) / 100,
    transaction_count: transactions.length,
    spending_by_category: sortedCategories,
  };
}
