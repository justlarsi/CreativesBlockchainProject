import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MarketplaceWorkDetailPage from "@/pages/MarketplaceWorkDetail";
import { getMarketplaceWorkDetail } from "@/api/marketplace";
import { prepareLicensePurchase, submitLicenseReceipt } from "@/api/licensing";

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/api/marketplace", async () => {
  const actual = await vi.importActual<typeof import("@/api/marketplace")>("@/api/marketplace");
  return {
    ...actual,
    getMarketplaceWorkDetail: vi.fn(),
  };
});

vi.mock("@/api/licensing", async () => {
  const actual = await vi.importActual<typeof import("@/api/licensing")>("@/api/licensing");
  return {
    ...actual,
    prepareLicensePurchase: vi.fn(),
    submitLicenseReceipt: vi.fn(),
  };
});

vi.mock("@/context/WalletContext", () => ({
  useWalletContext: () => ({
    isConnected: true,
    isCorrectChain: true,
  }),
}));

const sendTransactionAsync = vi.fn();
vi.mock("wagmi", async () => {
  const actual = await vi.importActual<typeof import("wagmi")>("wagmi");
  return {
    ...actual,
    useSendTransaction: () => ({
      sendTransactionAsync,
    }),
  };
});

const mockedGetMarketplaceWorkDetail = vi.mocked(getMarketplaceWorkDetail);
const mockedPrepareLicensePurchase = vi.mocked(prepareLicensePurchase);
const mockedSubmitLicenseReceipt = vi.mocked(submitLicenseReceipt);

describe("MarketplaceWorkDetail page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("access", "token");

    mockedGetMarketplaceWorkDetail.mockResolvedValue({
      work_id: 42,
      title: "Licensed Work",
      description: "Description",
      category: "image",
      status: "REGISTERED",
      ipfs_metadata_cid: "bafy123",
      license_type: "personal",
      price_amount: "10.00",
      price_wei: "100000000000000000",
      creator: {
        username: "creator",
        bio: "bio",
        wallet_address: "0x1111111111111111111111111111111111111111",
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    mockedPrepareLicensePurchase.mockResolvedValue({
      purchase_id: 5,
      status: "PENDING_CONFIRMATION",
      to: "0x2222222222222222222222222222222222222222",
      data: "0x1234",
      value: "0x10",
      chain_id: 80002,
      max_retries: 8,
    });

    sendTransactionAsync.mockResolvedValue("0x" + "a".repeat(64));
    mockedSubmitLicenseReceipt.mockResolvedValue({
      status: "PENDING_CONFIRMATION",
      purchase_id: 5,
      tx_hash: "0x" + "a".repeat(64),
      explorer_url: "https://amoy.polygonscan.com/tx/0x" + "a".repeat(64),
      message: "Receipt verification queued.",
      max_retries: 8,
    });
  });

  it("runs prepare + wallet tx + receipt flow", async () => {
    render(
      <MemoryRouter initialEntries={["/marketplace/works/42"]}>
        <Routes>
          <Route path="/marketplace/works/:workId" element={<MarketplaceWorkDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Licensed Work")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /purchase personal license/i }));

    await waitFor(() => {
      expect(mockedPrepareLicensePurchase).toHaveBeenCalledTimes(1);
      expect(sendTransactionAsync).toHaveBeenCalledTimes(1);
      expect(mockedSubmitLicenseReceipt).toHaveBeenCalledTimes(1);
      expect(mockedSubmitLicenseReceipt).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({
          purchase_id: 5,
          tx_hash: "0x" + "a".repeat(64),
          idempotency_key: expect.stringMatching(/^license-receipt-/),
        }),
      );
      expect(screen.getByText(/receipt verification queued/i)).toBeInTheDocument();
    });
  });
});


