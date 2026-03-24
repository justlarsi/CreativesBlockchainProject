import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import Dashboard from "@/pages/Dashboard";
import { getCreatorDashboard } from "@/api/dashboard";

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/api/dashboard", async () => {
  const actual = await vi.importActual<typeof import("@/api/dashboard")>("@/api/dashboard");
  return {
    ...actual,
    getCreatorDashboard: vi.fn(),
  };
});

const mockedGetCreatorDashboard = vi.mocked(getCreatorDashboard);

describe("Dashboard page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("access", "token");

    mockedGetCreatorDashboard.mockResolvedValue({
      date_range: { start_date: "2026-01-01", end_date: "2026-03-31" },
      generated_at: new Date().toISOString(),
      total_works: 5,
      registered_works: 3,
      total_licenses_sold: 2,
      revenue: { total_wei: "2500000000000000000", total_matic: "2.500000" },
      infringement: {
        total: 2,
        by_status: [
          { status: "pending", total: 1 },
          { status: "confirmed", total: 0 },
          { status: "false_positive", total: 0 },
          { status: "resolved", total: 1 },
        ],
      },
      works_by_category: [
        { category: "image", total: 3, registered: 2 },
        { category: "text", total: 2, registered: 1 },
      ],
      revenue_over_time: [{ period: "2026-03", revenue_wei: "2500000000000000000", revenue_matic: "2.500000", licenses_sold: 2 }],
    });
  });

  it("renders API-backed metrics", async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Total Works")).toBeInTheDocument();
      expect(screen.getByText("Revenue (MATIC)")).toBeInTheDocument();
      expect(screen.getByText("Licenses Sold")).toBeInTheDocument();
      expect(screen.getByText("Infringement Alerts")).toBeInTheDocument();
      expect(screen.getByText("Image")).toBeInTheDocument();
      expect(screen.getByText("Text")).toBeInTheDocument();
      expect(screen.getByText("2.500000 MATIC")).toBeInTheDocument();
    });
  });

  it("shows an error state when API fails", async () => {
    mockedGetCreatorDashboard.mockRejectedValueOnce(new Error("Service unavailable"));

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/could not load dashboard/i)).toBeInTheDocument();
      expect(screen.getByText("Service unavailable")).toBeInTheDocument();
    });
  });

  it("refetches data when date range changes", async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockedGetCreatorDashboard).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText("Date range"), { target: { value: "30d" } });

    await waitFor(() => {
      expect(mockedGetCreatorDashboard).toHaveBeenCalledTimes(2);
    });
  });
});

