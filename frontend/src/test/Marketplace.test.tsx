import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import Marketplace from "@/pages/Marketplace";
import { listMarketplaceListings } from "@/api/marketplace";

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/api/marketplace", async () => {
  const actual = await vi.importActual<typeof import("@/api/marketplace")>("@/api/marketplace");
  return {
    ...actual,
    listMarketplaceListings: vi.fn(),
  };
});

const mockedListMarketplaceListings = vi.mocked(listMarketplaceListings);

describe("Marketplace page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when API returns no items", async () => {
    mockedListMarketplaceListings.mockResolvedValueOnce({
      next: null,
      previous: null,
      results: [],
    });

    render(
      <MemoryRouter>
        <Marketplace />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/no listings found/i)).toBeInTheDocument();
    });
  });

  it("renders list item from API response", async () => {
    mockedListMarketplaceListings.mockResolvedValueOnce({
      next: null,
      previous: null,
      results: [
        {
          work_id: 5,
          title: "Market Work",
          description: "Sample",
          category: "image",
          license_type: "personal",
          price_amount: "25.00",
          creator: { username: "creator", avatar_url: null },
          created_at: new Date().toISOString(),
        },
      ],
    });

    render(
      <MemoryRouter>
        <Marketplace />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Market Work")).toBeInTheDocument();
      expect(screen.getByText("creator")).toBeInTheDocument();
    });
  });
});


