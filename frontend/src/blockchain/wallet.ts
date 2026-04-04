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
  const message = maybeError?.message?.toLowerCase() || "";

  if (maybeError?.code === 4001) {
    return "Request rejected in wallet.";
  }

  if (maybeError?.name === "ConnectorNotFoundError") {
    return "No wallet extension found. Install MetaMask or use WalletConnect.";
  }

  if (message.includes("connector not found")) {
    return "Wallet connector unavailable. Install MetaMask or enable WalletConnect.";
  }

  if (message.includes("provider") && message.includes("not found")) {
    return "Wallet provider not detected. Unlock MetaMask or refresh the page.";
  }

  if (message.includes("authentication credentials") || message.includes("not authorized") || message.includes("unauthorized")) {
    return "Log in to link or manage wallets.";
  }

  if (message.includes("missing or invalid")) {
    return "Wallet action failed due to provider configuration.";
  }

  return maybeError?.message || "Wallet action failed.";
}

