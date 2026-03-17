import { afterEach, describe, expect, it, vi } from "vitest";
import { createWorkMetadata, listWorks, uploadWorkBinary } from "@/api/works";

describe("works api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists works from paginated endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ results: [{ id: 1, title: "A" }] }), { status: 200 }),
      ),
    );

    const items = await listWorks("token");
    expect(items).toHaveLength(1);
  });

  it("surfaces normalized api error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { message: "Bad payload" } }), { status: 400 }),
      ),
    );

    await expect(
      createWorkMetadata("token", { title: "A", description: "", category: "image" }),
    ).rejects.toThrow("Bad payload");
  });

  it("uploads binary with PUT", async () => {
    const spy = vi.fn(async () => new Response(JSON.stringify({ id: 2 }), { status: 200 }));
    vi.stubGlobal("fetch", spy);

    await uploadWorkBinary("token", 2, new File(["hello"], "sample.txt", { type: "text/plain" }));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toContain("/api/v1/works/2/upload/");
  });
});

