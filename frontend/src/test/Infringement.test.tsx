import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import Infringement from "@/pages/Infringement";
import { cleanupLegacyInfringementAlerts, listInfringementAlerts, triggerPublicInfringementScan, updateInfringementAlertStatus } from "@/api/infringement";
import { listWorks } from "@/api/works";

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/api/infringement", async () => {
  const actual = await vi.importActual<typeof import("@/api/infringement")>("@/api/infringement");
  return {
    ...actual,
    cleanupLegacyInfringementAlerts: vi.fn(),
    listInfringementAlerts: vi.fn(),
    updateInfringementAlertStatus: vi.fn(),
    triggerPublicInfringementScan: vi.fn(),
  };
});

const mockedCleanupLegacyInfringementAlerts = vi.mocked(cleanupLegacyInfringementAlerts);
const mockedListInfringementAlerts = vi.mocked(listInfringementAlerts);
const mockedUpdateInfringementAlertStatus = vi.mocked(updateInfringementAlertStatus);
const mockedTriggerPublicInfringementScan = vi.mocked(triggerPublicInfringementScan);
const mockedListWorks = vi.mocked(listWorks);

vi.mock("@/api/works", () => ({
  listWorks: vi.fn(),
}));

describe("Infringement page", () => {
  beforeEach(() => {
        mockedCleanupLegacyInfringementAlerts.mockResolvedValue({
          status: "ok",
          mode: "hide",
          total_legacy: 1,
          hidden_count: 1,
          deleted_count: 0,
          deleted_active_count: 0,
        });
    vi.clearAllMocks();
    localStorage.setItem("access", "token");

    mockedListInfringementAlerts.mockResolvedValue([
      {
        id: 11,
        work_id: 3,
        work_title: "Nairobi Skyline",
        source_url: "https://mock.example/post/1",
        source_platform: "mock.example",
        source_fingerprint: "f".repeat(64),
        similarity_score: 0.9,
        severity: "high",
        status: "pending",
        detection_reason: "exact_hash_match",
        evidence: {},
        resolution_notes: "",
        first_detected_at: new Date().toISOString(),
        last_detected_at: new Date().toISOString(),
        resolved_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    mockedUpdateInfringementAlertStatus.mockResolvedValue({
      id: 11,
      work_id: 3,
      work_title: "Nairobi Skyline",
      source_url: "https://mock.example/post/1",
      source_platform: "mock.example",
      source_fingerprint: "f".repeat(64),
      similarity_score: 0.9,
      severity: "high",
      status: "confirmed",
      detection_reason: "exact_hash_match",
      evidence: {},
      resolution_notes: "",
      first_detected_at: new Date().toISOString(),
      last_detected_at: new Date().toISOString(),
      resolved_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    mockedTriggerPublicInfringementScan.mockResolvedValue({
      status: "processed",
      work_id: 3,
      scanned_candidates: 1,
      matched_candidates: 1,
      created_alert_ids: [11],
      platforms: ["instagram.com"],
    });
    mockedListWorks.mockResolvedValue([
      {
        id: 3,
        owner_id: 1,
        title: "Nairobi Skyline",
        description: "Golden skyline photo set",
        category: "image",
        status: "REGISTERED",
        original_filename: "skyline.png",
        file_size: 123,
        mime_type: "image/png",
        ipfs_metadata_cid: "",
        blockchain_tx_hash: "",
        blockchain_block_number: null,
        blockchain_registration_timestamp: null,
        blockchain_error_message: "",
        file: null,
        content_hashes: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);
  });

  it("renders API-backed alert rows", async () => {
    render(
      <MemoryRouter>
        <Infringement />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Nairobi Skyline")).toBeInTheDocument();
      expect(screen.getAllByTestId("infringement-alert-row")).toHaveLength(1);
    });
  });

  it("updates status from pending to confirmed", async () => {
    render(
      <MemoryRouter>
        <Infringement />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Nairobi Skyline")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => {
      expect(mockedUpdateInfringementAlertStatus).toHaveBeenCalledWith("token", 11, { status: "confirmed" });
    });
  });
});

