import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSignMessage, useSwitchChain } from "wagmi";
import { AMOY_CHAIN_ID, walletConnectEnabled } from "@/blockchain/wagmiConfig";
import { isAmoyChain, walletErrorMessage } from "@/blockchain/wallet";
import { createWalletChallenge, disconnectWallet as disconnectWalletApi, listWallets, verifyWalletChallenge, WalletRecord } from "@/api/wallet";
import { useAuth } from "@/context/AuthContext";

interface WalletContextValue {
  address?: string;
  chainId?: number;
  isConnected: boolean;
  isCorrectChain: boolean;
  isConnecting: boolean;
  isVerifying: boolean;
  error?: string;
  wallets: WalletRecord[];
  walletConnectEnabled: boolean;
  connectors: Array<{ id: string; name: string; ready: boolean }>;
  connectWallet: (connectorId?: string) => Promise<void>;
  disconnectWallet: (walletId?: number) => Promise<void>;
  switchToAmoy: () => Promise<void>;
  verifyConnectedWallet: () => Promise<void>;
  refreshWallets: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { address, chainId, isConnected } = useAccount();
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const { signMessageAsync } = useSignMessage();

  const [error, setError] = useState<string>();
  const [isVerifying, setIsVerifying] = useState(false);
  const [wallets, setWallets] = useState<WalletRecord[]>([]);

  const isCorrectChain = isAmoyChain(chainId);

  const connectorOptions = useMemo(
    () => connectors.map((connector) => ({ id: connector.id, name: connector.name, ready: connector.ready })),
    [connectors],
  );

  const refreshWallets = async () => {
    if (!isAuthenticated) {
      setWallets([]);
      return;
    }

    try {
      const records = await listWallets();
      setWallets(records);
    } catch (refreshError) {
      setError(walletErrorMessage(refreshError));
    }
  };

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!isAuthenticated) {
      setWallets([]);
      setError(undefined);
      return;
    }

    void refreshWallets();
  }, [isAuthenticated, isAuthLoading]);

  const connectWallet = async (connectorId?: string) => {
    setError(undefined);

    try {
      const connector = connectorId ? connectors.find((item) => item.id === connectorId) : connectors[0];
      if (!connector) {
        throw new Error("No wallet connector available.");
      }
      await connectAsync({ connector });
    } catch (connectError) {
      setError(walletErrorMessage(connectError));
    }
  };

  const switchToAmoy = async () => {
    setError(undefined);

    try {
      await switchChainAsync({ chainId: AMOY_CHAIN_ID });
    } catch (switchError) {
      setError(walletErrorMessage(switchError));
    }
  };

  const verifyConnectedWallet = async () => {
    setError(undefined);

    if (!isAuthenticated) {
      setError("Log in before linking a wallet.");
      return;
    }

    if (!address) {
      setError("Connect a wallet before verification.");
      return;
    }

    if (!isAmoyChain(chainId)) {
      setError("Switch to Polygon Amoy before verification.");
      return;
    }

    setIsVerifying(true);
    try {
      const challenge = await createWalletChallenge(address);
      const signature = await signMessageAsync({ message: challenge.message });

      await verifyWalletChallenge({
        challenge_id: challenge.challenge_id,
        signature,
        chain_id: chainId || AMOY_CHAIN_ID,
      });

      await refreshWallets();
    } catch (verifyError) {
      setError(walletErrorMessage(verifyError));
    } finally {
      setIsVerifying(false);
    }
  };

  const disconnectWallet = async (walletId?: number) => {
    setError(undefined);

    try {
      if (walletId) {
        await disconnectWalletApi(walletId);
      }
      await disconnectAsync();
      await refreshWallets();
    } catch (disconnectError) {
      setError(walletErrorMessage(disconnectError));
    }
  };

  return (
    <WalletContext.Provider
      value={{
        address,
        chainId,
        isConnected,
        isCorrectChain,
        isConnecting: isPending,
        isVerifying,
        error,
        wallets,
        walletConnectEnabled,
        connectors: connectorOptions,
        connectWallet,
        disconnectWallet,
        switchToAmoy,
        verifyConnectedWallet,
        refreshWallets,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWalletContext must be used inside WalletProvider");
  }
  return context;
}

