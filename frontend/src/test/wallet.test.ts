import { describe, expect, it } from "vitest";
import { isAmoyChain, shortenAddress, walletErrorMessage } from "@/blockchain/wallet";

describe("wallet helpers", () => {
  it("detects Polygon Amoy chain id", () => {
    expect(isAmoyChain(80002)).toBe(true);
    expect(isAmoyChain(137)).toBe(false);
    expect(isAmoyChain(undefined)).toBe(false);
  });

  it("shortens wallet addresses", () => {
    expect(shortenAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe("0x1234...5678");
    expect(shortenAddress("0x123")).toBe("");
  });

  it("maps common wallet errors to user-safe messages", () => {
    expect(walletErrorMessage({ code: 4001 })).toBe("Request rejected in wallet.");
    expect(walletErrorMessage({ name: "ConnectorNotFoundError" })).toContain("No wallet extension found");
    expect(walletErrorMessage({ message: "boom" })).toBe("boom");
  });
});

