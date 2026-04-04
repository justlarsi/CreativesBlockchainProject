import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import Works from "@/pages/Works";
import { listWorks } from "@/api/works";
import { triggerPublicInfringementScan } from "@/api/infringement";

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/RegisterWorkDialog", () => ({
  RegisterWorkDialog: () => null,
}));

vi.mock("@/hooks/useRegisterWorkOnChain", () => ({
  useRegisterWorkOnChain: () => ({
    registeringWorkId: null,
    handleRegisterOnChain: vi.fn(),
  }),
}));

vi.mock("@/api/works", async () => {
  const actual = await vi.importActual<typeof import("@/api/works")>("@/api/works");
  return {
    ...actual,
    listWorks: vi.fn(),
  };
});

vi.mock("@/api/infringement", async () => {
  const actual = await vi.importActual<typeof import("@/api/infringement")>("@/api/infringement");
  return {
    ...actual,
    triggerPublicInfringementScan: vi.fn(),
  };
});

const mockedListWorks = vi.mocked(listWorks);
const mockedTriggerPublicInfringementScan = vi.mocked(triggerPublicInfringementScan);

describe("Works page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedListWorks.mockResolvedValue([
      {
        id: 101,
        owner_id: 1,
        title: "Sunset Canvas",
        description: "A warm abstract skyline",
        category: "image",
        status: "REGISTERED",
        original_filename: "sunset.png",
        file_size: 1234,
        mime_type: "image/png",
        ipfs_metadata_cid: "",
        blockchain_tx_hash: "",
        blockchain_block_number: null,
        blockchain_registration_timestamp: null,
        blockchain_error_message: "",
        file: null,
        content_hashes: [
          {
            id: 1,
            hash_type: "sha256",
            hash_value: "a".repeat(64),
            created_at: new Date().toISOString(),
          },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    mockedTriggerPublicInfringementScan.mockResolvedValue({
      status: "processed",
      work_id: 101,
      scanned_candidates: 1,
      matched_candidates: 1,
      created_alert_ids: [1],
      platforms: ["instagram.com"],
    });
  });

  it("runs one-click scan from a work card", async () => {
    render(<Works />);

    await waitFor(() => {
      expect(screen.getByText("Sunset Canvas")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Scan this work" }));

    await waitFor(() => {
      expect(mockedTriggerPublicInfringementScan).toHaveBeenCalledTimes(1);
      expect(mockedTriggerPublicInfringementScan).toHaveBeenCalledWith({ work_id: 101 });
    });
  });
});
