import { authenticatedFetchJson, authenticatedFetch } from "./interceptors";

export interface WalletRecord {
  id: number;
  address: string;
  is_primary: boolean;
  created_at: string;
}

export interface WalletChallenge {
  challenge_id: number;
  wallet_address: string;
  message: string;
  expires_at: string;
}

export async function listWallets(): Promise<WalletRecord[]> {
  const data = await authenticatedFetchJson<{ results: WalletRecord[] }>(
    `/api/v1/auth/wallets/`,
    { method: "GET" }
  );
  return data.results || [];
}

export async function createWalletChallenge(address: string): Promise<WalletChallenge> {
  return authenticatedFetchJson<WalletChallenge>(
    `/api/v1/auth/wallets/challenge/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    }
  );
}

export async function verifyWalletChallenge(
  payload: { challenge_id: number; signature: string; chain_id: number },
): Promise<WalletRecord> {
  return authenticatedFetchJson<WalletRecord>(
    `/api/v1/auth/wallets/verify/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
}

export async function disconnectWallet(walletId: number): Promise<void> {
  const response = await authenticatedFetch(
    `/api/v1/auth/wallets/${walletId}/`,
    { method: "DELETE" }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.detail || "Failed to disconnect wallet.");
  }
}

