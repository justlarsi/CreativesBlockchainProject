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

const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function authHeaders(accessToken: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
}

async function parseJsonOrThrow(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.detail || "Wallet API request failed.");
  }
  return data;
}

export async function listWallets(accessToken: string): Promise<WalletRecord[]> {
  const response = await fetch(`${apiBase}/api/v1/auth/wallets/`, {
    method: "GET",
    headers: authHeaders(accessToken),
  });
  const data = await parseJsonOrThrow(response);
  return data.results || [];
}

export async function createWalletChallenge(accessToken: string, address: string): Promise<WalletChallenge> {
  const response = await fetch(`${apiBase}/api/v1/auth/wallets/challenge/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ address }),
  });
  return parseJsonOrThrow(response);
}

export async function verifyWalletChallenge(
  accessToken: string,
  payload: { challenge_id: number; signature: string; chain_id: number },
): Promise<WalletRecord> {
  const response = await fetch(`${apiBase}/api/v1/auth/wallets/verify/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response);
}

export async function disconnectWallet(accessToken: string, walletId: number): Promise<void> {
  const response = await fetch(`${apiBase}/api/v1/auth/wallets/${walletId}/`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.detail || "Failed to disconnect wallet.");
  }
}

