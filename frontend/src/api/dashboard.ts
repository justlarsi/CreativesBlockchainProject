import { authenticatedFetchJson } from "./interceptors";

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
  return authenticatedFetchJson<CreatorDashboardResponse>(
    `/api/v1/analytics/dashboard/${queryString}`,
    { method: "GET" }
  );
}

