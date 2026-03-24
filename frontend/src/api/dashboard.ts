export interface DashboardQueryParams {
  start_date?: string;
  end_date?: string;
}

export interface DashboardDateRange {
  start_date: string | null;
  end_date: string | null;
}

export interface DashboardRevenueTotals {
  total_wei: string;
  total_matic: string;
}

export interface DashboardInfringementStatusCount {
  status: "pending" | "confirmed" | "false_positive" | "resolved";
  total: number;
}

export interface DashboardInfringementMetrics {
  total: number;
  by_status: DashboardInfringementStatusCount[];
}

export interface DashboardWorksCategoryBreakdown {
  category: "image" | "audio" | "video" | "text" | "document";
  total: number;
  registered: number;
}

export interface DashboardRevenuePoint {
  period: string;
  revenue_wei: string;
  revenue_matic: string;
  licenses_sold: number;
}

export interface CreatorDashboardResponse {
  date_range: DashboardDateRange;
  generated_at: string;
  total_works: number;
  registered_works: number;
  total_licenses_sold: number;
  revenue: DashboardRevenueTotals;
  infringement: DashboardInfringementMetrics;
  works_by_category: DashboardWorksCategoryBreakdown[];
  revenue_over_time: DashboardRevenuePoint[];
}

const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function getAuthHeaders(accessToken: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
}

function extractErrorMessage(data: unknown): string {
  if (!data || typeof data !== "object") {
    return "Dashboard API request failed.";
  }

  const payload = data as Record<string, unknown>;
  const errorPayload = payload.error as Record<string, unknown> | undefined;
  if (errorPayload && typeof errorPayload.message === "string") {
    return errorPayload.message;
  }

  if (typeof payload.detail === "string") {
    return payload.detail;
  }

  return "Dashboard API request failed.";
}

async function parseJsonOrThrow(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(extractErrorMessage(data));
  }
  return data;
}

function buildQueryString(params?: DashboardQueryParams): string {
  if (!params) {
    return "";
  }

  const query = new URLSearchParams();
  if (params.start_date) {
    query.set("start_date", params.start_date);
  }
  if (params.end_date) {
    query.set("end_date", params.end_date);
  }

  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

export async function getCreatorDashboard(
  accessToken: string,
  params?: DashboardQueryParams,
): Promise<CreatorDashboardResponse> {
  const queryString = buildQueryString(params);
  const response = await fetch(`${apiBase}/api/v1/analytics/dashboard/${queryString}`, {
    method: "GET",
    headers: getAuthHeaders(accessToken),
  });
  return parseJsonOrThrow(response);
}

