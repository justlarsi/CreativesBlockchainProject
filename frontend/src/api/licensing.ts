import { authenticatedFetchJson } from "./interceptors";

export type LicenseTemplate = "personal" | "commercial" | "exclusive";
export type RightsScope = "non_commercial" | "commercial";
export interface LicensePrepareRequest {
  work_id: number;
  template: LicenseTemplate;
  rights_scope: RightsScope;
}
export interface LicensePrepareResponse {
  purchase_id: number;
  status: "PENDING_CONFIRMATION";
  to: string;
  data: string;
  value: string;
  chain_id: number;
  max_retries: number;
}
export interface LicenseReceiptRequest {
  purchase_id: number;
  idempotency_key: string;
  tx_hash: string;
}
export interface LicenseReceiptResponse {
  status: "PENDING_CONFIRMATION" | "ACTIVE";
  purchase_id: number;
  tx_hash: string;
  explorer_url: string;
  message: string;
  max_retries?: number;
}
export interface LicensePurchaseRecord {
  id: number;
  work_id: number;
  buyer_id: number;
  creator_id: number;
  template: LicenseTemplate;
  rights_scope: RightsScope;
  is_exclusive: boolean;
  amount_wei: number;
  tx_hash: string;
  block_number: number | null;
  purchased_at: string | null;
  status: "PENDING_CONFIRMATION" | "ACTIVE" | "FAILED";
  error_message: string;
  explorer_url: string;
  created_at: string;
  updated_at: string;
}

const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export async function prepareLicensePurchase(
  payload: LicensePrepareRequest,
): Promise<LicensePrepareResponse> {
  return authenticatedFetchJson<LicensePrepareResponse>(
    `/api/v1/licenses/prepare/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
}

export async function submitLicenseReceipt(
  tokenOrPayload: string | LicenseReceiptRequest,
  maybePayload?: LicenseReceiptRequest,
): Promise<LicenseReceiptResponse> {
  const token = typeof tokenOrPayload === "string" ? tokenOrPayload : null;
  const payload = typeof tokenOrPayload === "string" ? maybePayload : tokenOrPayload;

  if (!payload) {
    throw new Error("Missing license receipt payload");
  }

  return authenticatedFetchJson<LicenseReceiptResponse>(
    `/api/v1/licenses/receipt/`,
    {
      method: "POST",
      headers: token
        ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
        : { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
}

export async function getLicenseDetail(purchaseId: number): Promise<LicensePurchaseRecord> {
  return authenticatedFetchJson<LicensePurchaseRecord>(
    `/api/v1/licenses/${purchaseId}/`,
    { method: "GET" }
  );
}

export async function listMyLicenses(): Promise<LicensePurchaseRecord[]> {
  const data = await authenticatedFetchJson<{ results: LicensePurchaseRecord[] }>(
    `/api/v1/licenses/`,
    { method: "GET" }
  );
  return data.results || [];
}

export function certificateDownloadUrl(purchaseId: number): string {
  return `${apiBase}/api/v1/licenses/${purchaseId}/certificate/`;
}
