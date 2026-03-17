import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WalletConnect } from "@/components/WalletConnect";

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({
    address: undefined,
    isConnected: false,
    isCorrectChain: false,
    isConnecting: false,
    isVerifying: false,
    wallets: [],
    error: undefined,
    connectors: [
      { id: "injected", name: "MetaMask", ready: true },
      { id: "walletConnect", name: "WalletConnect", ready: true },
    ],
    walletConnectEnabled: true,
    connectWallet: vi.fn(async () => undefined),
    disconnectWallet: vi.fn(async () => undefined),
    switchToAmoy: vi.fn(async () => undefined),
    verifyConnectedWallet: vi.fn(async () => undefined),
  }),
}));

describe("WalletConnect", () => {
  it("renders connect options when disconnected", () => {
    render(<WalletConnect />);

    expect(screen.getByRole("button", { name: /connect metamask/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect walletconnect/i })).toBeInTheDocument();
  });
});

