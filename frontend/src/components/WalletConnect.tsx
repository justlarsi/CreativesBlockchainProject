import { useState } from "react";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChainGate } from "@/components/ChainGate";
import { useWallet } from "@/hooks/useWallet";
import { shortenAddress } from "@/blockchain/wallet";

export function WalletConnect() {
  const [isSwitching, setIsSwitching] = useState(false);
  const {
    address,
    isConnected,
    isCorrectChain,
    isConnecting,
    isVerifying,
    wallets,
    error,
    connectors,
    walletConnectEnabled,
    connectWallet,
    disconnectWallet,
    switchToAmoy,
    verifyConnectedWallet,
  } = useWallet();

  const primaryWallet = wallets.find((wallet) => wallet.is_primary);

  const handleSwitch = async () => {
    setIsSwitching(true);
    await switchToAmoy();
    setIsSwitching(false);
  };

  if (!isConnected) {
    return (
      <div className="flex items-center gap-2">
        {connectors.map((connector) => {
          if (!walletConnectEnabled && connector.id.includes("walletConnect")) {
            return null;
          }
          return (
            <Button
              key={connector.id}
              size="sm"
              variant="outline"
              onClick={() => void connectWallet(connector.id)}
              disabled={isConnecting || !connector.ready}
              className="h-8 text-xs"
            >
              {isConnecting ? "Connecting..." : `Connect ${connector.name}`}
            </Button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      {!isCorrectChain && <ChainGate onSwitch={handleSwitch} isSwitching={isSwitching} />}

      <div className="flex items-center gap-2">
        <div className="h-8 rounded-full bg-primary/10 border border-primary/30 px-3 flex items-center gap-2">
          <Wallet className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">{shortenAddress(address)}</span>
        </div>

        <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => void verifyConnectedWallet()} disabled={isVerifying || !isCorrectChain}>
          {isVerifying ? "Verifying..." : "Verify"}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs"
          onClick={() => void disconnectWallet(primaryWallet?.id)}
        >
          Disconnect
        </Button>
      </div>

      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

