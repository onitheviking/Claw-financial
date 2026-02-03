import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from "plaid";
import { CONFIG } from "./config";

let client: PlaidApi | null = null;

export function getPlaidClient(): PlaidApi {
  if (client) return client;
  const configuration = new Configuration({
    basePath: PlaidEnvironments[CONFIG.plaid.env],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": CONFIG.plaid.clientId,
        "PLAID-SECRET": CONFIG.plaid.secret,
      },
    },
  });
  client = new PlaidApi(configuration);
  return client;
}

export async function createLinkToken(userId: string): Promise<string> {
  const plaid = getPlaidClient();
  const response = await plaid.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: "Claw Financial",
    products: CONFIG.plaid.products as Products[],
    country_codes: CONFIG.plaid.countryCodes as CountryCode[],
    language: CONFIG.plaid.language,
  });
  return response.data.link_token;
}

export async function exchangePublicToken(publicToken: string): Promise<{
  accessToken: string;
  itemId: string;
}> {
  const plaid = getPlaidClient();
  const response = await plaid.itemPublicTokenExchange({
    public_token: publicToken,
  });
  return {
    accessToken: response.data.access_token,
    itemId: response.data.item_id,
  };
}

export async function getInstitutionInfo(
  institutionId: string,
): Promise<{ name: string; logo: string | null }> {
  const plaid = getPlaidClient();
  const response = await plaid.institutionsGetById({
    institution_id: institutionId,
    country_codes: CONFIG.plaid.countryCodes as CountryCode[],
  });
  return {
    name: response.data.institution.name,
    logo: response.data.institution.logo ?? null,
  };
}

export async function getAccounts(accessToken: string) {
  const plaid = getPlaidClient();
  const response = await plaid.accountsGet({ access_token: accessToken });
  return response.data.accounts;
}

export async function getBalances(accessToken: string) {
  const plaid = getPlaidClient();
  const response = await plaid.accountsBalanceGet({
    access_token: accessToken,
  });
  return response.data.accounts;
}

export async function syncTransactions(
  accessToken: string,
  cursor?: string | null,
) {
  const plaid = getPlaidClient();
  let allAdded: any[] = [];
  let allModified: any[] = [];
  let allRemoved: any[] = [];
  let hasMore = true;
  let nextCursor = cursor || undefined;

  while (hasMore) {
    const response = await plaid.transactionsSync({
      access_token: accessToken,
      cursor: nextCursor,
    });
    allAdded = allAdded.concat(response.data.added);
    allModified = allModified.concat(response.data.modified);
    allRemoved = allRemoved.concat(response.data.removed);
    hasMore = response.data.has_more;
    nextCursor = response.data.next_cursor;
  }

  return {
    added: allAdded,
    modified: allModified,
    removed: allRemoved,
    cursor: nextCursor!,
  };
}

export async function removeItem(accessToken: string): Promise<void> {
  const plaid = getPlaidClient();
  await plaid.itemRemove({ access_token: accessToken });
}
