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
function getAuthHeaders(accessToken: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
}
function extractErrorMessage(data: unknown): string {
  if (!data || typeof data !== "object") {
    return "Licensing API request failed.";
  }
  const payload = data as Record<string, unknown>;
  const errorPayload = payload.error as Record<string, unknown> | undefined;
  if (errorPayload && typeof errorPayload.message === "string") {
    return errorPayload.message;
  }
  if (typeof payload.detail === "string") {
    return payload.detail;
  }
  return "Licensing API request failed.";
}
async function parseJsonOrThrow(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(extractErrorMessage(data));
  }
  return data;
}
export async function prepareLicensePurchase(
  accessToken: string,
  payload: LicensePrepareRequest,
): Promise<LicensePrepareResponse> {
  const response = await fetch(`${apiBase}/api/v1/licenses/prepare/`, {
    method: "POST",
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response);
}
export async function submitLicenseReceipt(
  accessToken: string,
  payload: LicenseReceiptRequest,
): Promise<LicenseReceiptResponse> {
  const response = await fetch(`${apiBase}/api/v1/licenses/receipt/`, {
    method: "POST",
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response);
}
export async function getLicenseDetail(accessToken: string, purchaseId: number): Promise<LicensePurchaseRecord> {
  const response = await fetch(`${apiBase}/api/v1/licenses/${purchaseId}/`, {
    method: "GET",
    headers: getAuthHeaders(accessToken),
  });
  return parseJsonOrThrow(response);
}
export async function listMyLicenses(accessToken: string): Promise<LicensePurchaseRecord[]> {
  const response = await fetch(`${apiBase}/api/v1/licenses/`, {
    method: "GET",
    headers: getAuthHeaders(accessToken),
  });
  const data = await parseJsonOrThrow(response);
  return data.results || [];
}
export function certificateDownloadUrl(purchaseId: number): string {
  return `${apiBase}/api/v1/licenses/${purchaseId}/certificate/`;
}
