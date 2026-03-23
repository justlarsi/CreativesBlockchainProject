import { afterEach, describe, expect, it, vi } from "vitest";
import { cursorFromUrl, getMarketplaceWorkDetail, listMarketplaceListings } from "@/api/marketplace";

describe("marketplace api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists marketplace items with query parameters", async () => {
    const spy = vi.fn(async () =>
      new Response(
        JSON.stringify({
          next: null,
          previous: null,
          results: [{ work_id: 1, title: "A", creator: { username: "u", avatar_url: null } }],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", spy);

    const data = await listMarketplaceListings({ category: "image", search: "sunset" });
    expect(data.results).toHaveLength(1);
    const firstCallUrl = String((spy as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0]);
    expect(firstCallUrl).toContain("category=image");
    expect(firstCallUrl).toContain("search=sunset");
  });

  it("loads marketplace work detail", async () => {
    const spy = vi.fn(async () =>
      new Response(
        JSON.stringify({
          work_id: 10,
          title: "Detail",
          description: "D",
          category: "image",
          status: "REGISTERED",
          ipfs_metadata_cid: "",
          license_type: "personal",
          price_amount: "10.00",
          price_wei: "10000000000000000000",
          creator: { username: "creator", bio: "b", wallet_address: null },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", spy);

    const item = await getMarketplaceWorkDetail(10);
    expect(item.work_id).toBe(10);
    const firstCallUrl = String((spy as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0]);
    expect(firstCallUrl).toContain("/api/v1/marketplace/works/10/");
  });

  it("extracts cursor from next links", () => {
    const cursor = cursorFromUrl("http://localhost:8000/api/v1/marketplace/?cursor=abc123");
    expect(cursor).toBe("abc123");
  });
});


