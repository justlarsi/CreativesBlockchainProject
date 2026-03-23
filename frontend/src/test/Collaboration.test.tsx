import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import Collaboration from "@/pages/Collaboration";
import { approveCollaboration, listCollaborations } from "@/api/collaboration";

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/api/collaboration", async () => {
  const actual = await vi.importActual<typeof import("@/api/collaboration")>("@/api/collaboration");
  return {
    ...actual,
    listCollaborations: vi.fn(),
    approveCollaboration: vi.fn(),
  };
});

const mockedListCollaborations = vi.mocked(listCollaborations);
const mockedApproveCollaboration = vi.mocked(approveCollaboration);

describe("Collaboration page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("access", "token");

    mockedListCollaborations.mockResolvedValue([
      {
        id: 3,
        work_id: 51,
        creator_id: 1,
        status: "PENDING_APPROVAL",
        blockchain_tx_hash: "",
        blockchain_block_number: null,
        blockchain_registered_at: null,
        blockchain_error_message: "",
        approvals_required: 2,
        approvals_received: 1,
        members: [
          {
            id: 71,
            user_id: 1,
            username: "creator",
            email: "creator@example.com",
            wallet_address: "0x1111111111111111111111111111111111111111",
            split_bps: 6000,
            approval_status: "APPROVED",
            approved_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: 72,
            user_id: 2,
            username: "member",
            email: "member@example.com",
            wallet_address: "0x2222222222222222222222222222222222222222",
            split_bps: 4000,
            approval_status: "PENDING",
            approved_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);
    mockedApproveCollaboration.mockResolvedValue({ detail: "ok" });
  });

  it("renders API-backed collaboration row", async () => {
    render(
      <MemoryRouter>
        <Collaboration />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByTestId("collaboration-row")).toHaveLength(1);
      expect(screen.getByText("Work #51")).toBeInTheDocument();
      expect(screen.getByText("Approvals 1/2")).toBeInTheDocument();
    });
  });

  it("approves pending collaboration", async () => {
    render(
      <MemoryRouter>
        <Collaboration />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("approve-collaboration")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("approve-collaboration"));

    await waitFor(() => {
      expect(mockedApproveCollaboration).toHaveBeenCalledWith("token", 3);
    });
  });
});

