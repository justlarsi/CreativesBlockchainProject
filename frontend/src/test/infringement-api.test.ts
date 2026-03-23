import { afterEach, describe, expect, it, vi } from "vitest";
import { listInfringementAlerts, triggerInfringementScan, updateInfringementAlertStatus } from "@/api/infringement";

describe("infringement api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists alerts for authenticated user", async () => {
    const spy = vi.fn(async () =>
      new Response(
        JSON.stringify({
          next: null,
          previous: null,
          results: [{ id: 1, status: "pending", source_url: "https://mock.example" }],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", spy);

    const data = await listInfringementAlerts("token");
    expect(data).toHaveLength(1);
    const call = (spy as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect(String(call[0])).toContain("/api/v1/infringement/alerts/");
    expect((call[1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer token" });
  });

  it("updates alert status", async () => {
    const spy = vi.fn(async () =>
      new Response(JSON.stringify({ id: 7, status: "resolved" }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", spy);

    const updated = await updateInfringementAlertStatus("token", 7, { status: "resolved" });
    expect(updated.status).toBe("resolved");
    const firstCallUrl = String((spy as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0]);
    expect(firstCallUrl).toContain("/api/v1/infringement/alerts/7/");
  });

  it("triggers a simulated scan", async () => {
    const spy = vi.fn(async () =>
      new Response(
        JSON.stringify({ status: "queued", work_id: 10, candidates_count: 1 }),
        { status: 202 },
      ),
    );
    vi.stubGlobal("fetch", spy);

    const result = await triggerInfringementScan("token", {
      work_id: 10,
      candidates: [{ source_url: "https://mock.example/p/1" }],
    });
    expect(result.status).toBe("queued");
    const firstCallUrl = String((spy as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0]);
    expect(firstCallUrl).toContain("/api/v1/infringement/scan/");
  });
});

