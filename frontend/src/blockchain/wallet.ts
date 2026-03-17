import { AMOY_CHAIN_ID } from "@/blockchain/wagmiConfig";

export function isAmoyChain(chainId?: number): boolean {
  return chainId === AMOY_CHAIN_ID;
}

export function shortenAddress(address?: string): string {
  if (!address || address.length < 10) {
    return "";
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function walletErrorMessage(error: unknown): string {
  const maybeError = error as { code?: number; message?: string; name?: string } | null;

  if (maybeError?.code === 4001) {
    return "Request rejected in wallet.";
  }

  if (maybeError?.name === "ConnectorNotFoundError") {
    return "No wallet extension found. Install MetaMask or use WalletConnect.";
  }

  if (maybeError?.message?.toLowerCase().includes("missing or invalid")) {
    return "Wallet action failed due to provider configuration.";
  }

  return maybeError?.message || "Wallet action failed.";
}

