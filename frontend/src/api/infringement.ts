export type InfringementSeverity = "low" | "medium" | "high" | "critical";
export type InfringementStatus = "pending" | "confirmed" | "false_positive" | "resolved";

export interface InfringementAlertRecord {
  id: number;
  work_id: number;
  work_title: string;
  source_url: string;
  source_platform: string;
  source_fingerprint: string;
  similarity_score: number;
  severity: InfringementSeverity;
  status: InfringementStatus;
  detection_reason: string;
  evidence: Record<string, unknown>;
  resolution_notes: string;
  first_detected_at: string;
  last_detected_at: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InfringementAlertListResponse {
  next: string | null;
  previous: string | null;
  results: InfringementAlertRecord[];
}

export interface SimulatedSourceCandidate {
  source_url: string;
  source_platform?: string;
  source_hash?: string;
  title?: string;
  description?: string;
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
    return "Infringement API request failed.";
  }

  const payload = data as Record<string, unknown>;
  const errorPayload = payload.error as Record<string, unknown> | undefined;
  if (errorPayload && typeof errorPayload.message === "string") {
    return errorPayload.message;
  }

  if (typeof payload.detail === "string") {
    return payload.detail;
  }

  return "Infringement API request failed.";
}

async function parseJsonOrThrow(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(extractErrorMessage(data));
  }
  return data;
}

export async function listInfringementAlerts(accessToken: string): Promise<InfringementAlertRecord[]> {
  const response = await fetch(`${apiBase}/api/v1/infringement/alerts/`, {
    method: "GET",
    headers: getAuthHeaders(accessToken),
  });
  const data: InfringementAlertListResponse = await parseJsonOrThrow(response);
  return data.results || [];
}

export async function updateInfringementAlertStatus(
  accessToken: string,
  alertId: number,
  payload: { status: InfringementStatus; resolution_notes?: string },
): Promise<InfringementAlertRecord> {
  const response = await fetch(`${apiBase}/api/v1/infringement/alerts/${alertId}/`, {
    method: "PATCH",
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response);
}

export async function triggerInfringementScan(
  accessToken: string,
  payload: { work_id: number; candidates: SimulatedSourceCandidate[] },
): Promise<{ status: string; work_id: number; candidates_count: number }> {
  const response = await fetch(`${apiBase}/api/v1/infringement/scan/`, {
    method: "POST",
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response);
}

