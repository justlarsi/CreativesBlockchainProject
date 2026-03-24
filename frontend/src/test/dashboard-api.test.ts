import { afterEach, describe, expect, it, vi } from "vitest";

import { getCreatorDashboard } from "@/api/dashboard";

describe("dashboard api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches creator dashboard with date-range query", async () => {
    const spy = vi.fn(async () =>
      new Response(
        JSON.stringify({
          date_range: { start_date: "2026-01-01", end_date: "2026-03-01" },
          generated_at: new Date().toISOString(),
          total_works: 2,
          registered_works: 1,
          total_licenses_sold: 3,
          revenue: { total_wei: "1000000000000000000", total_matic: "1.000000" },
          infringement: {
            total: 1,
            by_status: [
              { status: "pending", total: 1 },
              { status: "confirmed", total: 0 },
              { status: "false_positive", total: 0 },
              { status: "resolved", total: 0 },
            ],
          },
          works_by_category: [{ category: "image", total: 2, registered: 1 }],
          revenue_over_time: [{ period: "2026-02", revenue_wei: "100", revenue_matic: "0.000000", licenses_sold: 1 }],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", spy);

    const result = await getCreatorDashboard("token", {
      start_date: "2026-01-01",
      end_date: "2026-03-01",
    });

    expect(result.total_works).toBe(2);
    expect(String(spy.mock.calls[0]?.[0])).toContain("/api/v1/analytics/dashboard/");
    expect(String(spy.mock.calls[0]?.[0])).toContain("start_date=2026-01-01");
    expect(String(spy.mock.calls[0]?.[0])).toContain("end_date=2026-03-01");
  });

  it("surfaces normalized API errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { message: "Invalid date range" } }), { status: 400 }),
      ),
    );

    await expect(getCreatorDashboard("token", { start_date: "2026-03-01" })).rejects.toThrow("Invalid date range");
  });
});

