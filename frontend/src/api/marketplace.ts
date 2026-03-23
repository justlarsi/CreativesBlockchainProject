export type MarketplaceCategory = "image" | "audio" | "video" | "text" | "document";
export type MarketplaceLicenseType = "personal" | "commercial" | "exclusive";

export interface MarketplaceListItem {
  work_id: number;
  title: string;
  description: string;
  category: MarketplaceCategory;
  license_type: MarketplaceLicenseType;
  price_amount: string;
  creator: {
    username: string;
    avatar_url: string | null;
  };
  created_at: string;
}

export interface MarketplaceWorkDetail {
  work_id: number;
  title: string;
  description: string;
  category: MarketplaceCategory;
  status: string;
  ipfs_metadata_cid: string;
  license_type: MarketplaceLicenseType;
  price_amount: string;
  price_wei: string;
  creator: {
    username: string;
    bio: string;
    wallet_address: string | null;
  };
  created_at: string;
  updated_at: string;
}

export interface MarketplaceListResponse {
  next: string | null;
  previous: string | null;
  results: MarketplaceListItem[];
}

export interface MarketplaceListParams {
  category?: MarketplaceCategory;
  license_type?: MarketplaceLicenseType;
  search?: string;
  min_price?: string;
  max_price?: string;
  cursor?: string;
}

const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function extractErrorMessage(data: unknown): string {
  if (!data || typeof data !== "object") {
    return "Marketplace API request failed.";
  }

  const payload = data as Record<string, unknown>;
  const errorPayload = payload.error as Record<string, unknown> | undefined;
  if (errorPayload && typeof errorPayload.message === "string") {
    return errorPayload.message;
  }

  if (typeof payload.detail === "string") {
    return payload.detail;
  }

  return "Marketplace API request failed.";
}

async function parseJsonOrThrow(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(extractErrorMessage(data));
  }
  return data;
}

function buildListUrl(params: MarketplaceListParams): string {
  const searchParams = new URLSearchParams();

  if (params.category) {
    searchParams.set("category", params.category);
  }
  if (params.license_type) {
    searchParams.set("license_type", params.license_type);
  }
  if (params.search) {
    searchParams.set("search", params.search);
  }
  if (params.min_price) {
    searchParams.set("min_price", params.min_price);
  }
  if (params.max_price) {
    searchParams.set("max_price", params.max_price);
  }
  if (params.cursor) {
    searchParams.set("cursor", params.cursor);
  }

  const query = searchParams.toString();
  return `${apiBase}/api/v1/marketplace/${query ? `?${query}` : ""}`;
}

export async function listMarketplaceListings(
  params: MarketplaceListParams = {},
): Promise<MarketplaceListResponse> {
  const response = await fetch(buildListUrl(params), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
  return parseJsonOrThrow(response);
}

export async function getMarketplaceWorkDetail(workId: number): Promise<MarketplaceWorkDetail> {
  const response = await fetch(`${apiBase}/api/v1/marketplace/works/${workId}/`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
  return parseJsonOrThrow(response);
}

export function cursorFromUrl(url: string | null): string | undefined {
  if (!url) {
    return undefined;
  }

  try {
    const parsed = new URL(url);
    const value = parsed.searchParams.get("cursor");
    return value || undefined;
  } catch {
    return undefined;
  }
}

