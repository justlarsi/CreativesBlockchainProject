export type CollaborationStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "BLOCKCHAIN_REGISTRATION_PENDING"
  | "REGISTERED"
  | "BLOCKCHAIN_REGISTRATION_FAILED";

export type CollaborationMemberApprovalStatus = "PENDING" | "APPROVED";

export interface CollaborationMemberRecord {
  id: number;
  user_id: number;
  username: string;
  email: string;
  wallet_address: string;
  split_bps: number;
  approval_status: CollaborationMemberApprovalStatus;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CollaborationRecord {
  id: number;
  work_id: number;
  creator_id: number;
  status: CollaborationStatus;
  blockchain_tx_hash: string;
  blockchain_block_number: number | null;
  blockchain_registered_at: string | null;
  blockchain_error_message: string;
  approvals_required: number;
  approvals_received: number;
  members: CollaborationMemberRecord[];
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
    return "Collaboration API request failed.";
  }

  const payload = data as Record<string, unknown>;
  const errorPayload = payload.error as Record<string, unknown> | undefined;
  if (errorPayload && typeof errorPayload.message === "string") {
    return errorPayload.message;
  }

  if (typeof payload.detail === "string") {
    return payload.detail;
  }

  return "Collaboration API request failed.";
}

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(extractErrorMessage(data));
  }
  return data as T;
}

export async function listCollaborations(accessToken: string): Promise<CollaborationRecord[]> {
  const response = await fetch(`${apiBase}/api/v1/collaborations/`, {
    method: "GET",
    headers: getAuthHeaders(accessToken),
  });

  return parseJsonOrThrow<CollaborationRecord[]>(response);
}

export async function approveCollaboration(accessToken: string, collaborationId: number): Promise<unknown> {
  const response = await fetch(`${apiBase}/api/v1/collaborations/${collaborationId}/approve/`, {
    method: "PATCH",
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify({ approved: true }),
  });

  return parseJsonOrThrow<unknown>(response);
}

