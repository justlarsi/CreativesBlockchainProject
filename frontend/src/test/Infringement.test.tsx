import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import Infringement from "@/pages/Infringement";
import { listInfringementAlerts, triggerInfringementScan, updateInfringementAlertStatus } from "@/api/infringement";

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/api/infringement", async () => {
  const actual = await vi.importActual<typeof import("@/api/infringement")>("@/api/infringement");
  return {
    ...actual,
    listInfringementAlerts: vi.fn(),
    updateInfringementAlertStatus: vi.fn(),
    triggerInfringementScan: vi.fn(),
  };
});

const mockedListInfringementAlerts = vi.mocked(listInfringementAlerts);
const mockedUpdateInfringementAlertStatus = vi.mocked(updateInfringementAlertStatus);
const mockedTriggerInfringementScan = vi.mocked(triggerInfringementScan);

describe("Infringement page", () => {
  beforeEach(() => {
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

    mockedTriggerInfringementScan.mockResolvedValue({ status: "queued", work_id: 3, candidates_count: 1 });
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

