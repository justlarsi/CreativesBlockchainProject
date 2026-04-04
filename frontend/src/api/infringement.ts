import { authenticatedFetchJson } from "./interceptors";

function withAuthHeader(
  token: string | null | undefined,
  headers?: Record<string, string>,
): Record<string, string> {
  if (!token) {
    return headers || {};
  }

  return {
    ...(headers || {}),
    Authorization: `Bearer ${token}`,
  };
}

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

export async function listInfringementAlerts(token?: string): Promise<InfringementAlertRecord[]> {
  const data = await authenticatedFetchJson<InfringementAlertListResponse>(
    `/api/v1/infringement/alerts/`,
    {
      method: "GET",
      headers: withAuthHeader(token),
    }
  );
  return data.results || [];
}

export async function updateInfringementAlertStatus(
  tokenOrAlertId: string | number,
  alertIdOrPayload: number | { status: InfringementStatus; resolution_notes?: string },
  maybePayload?: { status: InfringementStatus; resolution_notes?: string },
): Promise<InfringementAlertRecord> {
  const token = typeof tokenOrAlertId === "string" ? tokenOrAlertId : null;
  const alertId = typeof tokenOrAlertId === "string" ? (alertIdOrPayload as number) : tokenOrAlertId;
  const payload = typeof tokenOrAlertId === "string" ? maybePayload : (alertIdOrPayload as { status: InfringementStatus; resolution_notes?: string });

  if (!payload) {
    throw new Error("Missing status update payload");
  }

  return authenticatedFetchJson<InfringementAlertRecord>(
    `/api/v1/infringement/alerts/${alertId}/`,
    {
      method: "PATCH",
      headers: withAuthHeader(token, { "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }
  );
}

export async function triggerInfringementScan(
  tokenOrPayload: string | { work_id: number; candidates: SimulatedSourceCandidate[] },
  maybePayload?: { work_id: number; candidates: SimulatedSourceCandidate[] },
): Promise<{ status: string; work_id: number; candidates_count: number }> {
  const token = typeof tokenOrPayload === "string" ? tokenOrPayload : null;
  const payload = typeof tokenOrPayload === "string" ? maybePayload : tokenOrPayload;

  if (!payload) {
    throw new Error("Missing scan payload");
  }

  return authenticatedFetchJson<{ status: string; work_id: number; candidates_count: number }>(
    `/api/v1/infringement/scan/`,
    {
      method: "POST",
      headers: withAuthHeader(token, { "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }
  );
}

