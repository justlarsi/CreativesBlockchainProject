import { afterEach, describe, expect, it, vi } from "vitest";
import { approveCollaboration, listCollaborations } from "@/api/collaboration";

describe("collaboration api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists collaborations", async () => {
    const spy = vi.fn(async () =>
      new Response(
        JSON.stringify([
          {
            id: 9,
            work_id: 44,
            creator_id: 2,
            status: "PENDING_APPROVAL",
            blockchain_tx_hash: "",
            blockchain_block_number: null,
            blockchain_registered_at: null,
            blockchain_error_message: "",
            approvals_required: 2,
            approvals_received: 1,
            members: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", spy);

    const result = await listCollaborations("token");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(9);
    expect(String(spy.mock.calls[0]?.[0])).toContain("/api/v1/collaborations/");
  });

  it("approves collaboration member", async () => {
    const spy = vi.fn(async () => new Response(JSON.stringify({ detail: "ok" }), { status: 200 }));
    vi.stubGlobal("fetch", spy);

    await approveCollaboration("token", 19);

    expect(String(spy.mock.calls[0]?.[0])).toContain("/api/v1/collaborations/19/approve/");
  });

  it("returns normalized errors", async () => {
    const spy = vi.fn(async () => new Response(JSON.stringify({ detail: "No permission" }), { status: 403 }));
    vi.stubGlobal("fetch", spy);

    await expect(listCollaborations("token")).rejects.toThrow("No permission");
  });
});

