import { authenticatedFetchJson } from "./interceptors";

function withAuthHeader(token: string | null | undefined, headers?: HeadersInit): Headers {
  const nextHeaders = new Headers(headers || {});
  if (token) {
    nextHeaders.set("Authorization", `Bearer ${token}`);
  }
  return nextHeaders;
}

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

export async function listCollaborations(token?: string): Promise<CollaborationRecord[]> {
  return authenticatedFetchJson<CollaborationRecord[]>(
    `/api/v1/collaborations/`,
    {
      method: "GET",
      headers: withAuthHeader(token),
    }
  );
}

export async function approveCollaboration(
  tokenOrCollaborationId: string | number,
  maybeCollaborationId?: number,
): Promise<unknown> {
  const token = typeof tokenOrCollaborationId === "string" ? tokenOrCollaborationId : null;
  const collaborationId =
    typeof tokenOrCollaborationId === "string"
      ? maybeCollaborationId
      : tokenOrCollaborationId;

  if (!collaborationId) {
    throw new Error("Missing collaboration id");
  }

  return authenticatedFetchJson<unknown>(
    `/api/v1/collaborations/${collaborationId}/approve/`,
    {
      method: "PATCH",
      headers: withAuthHeader(token, { "Content-Type": "application/json" }),
      body: JSON.stringify({ approved: true }),
    }
  );
}

export interface EarningsInfo {
  total_earned: number;
  currency: string;
  members: Array<{
    username: string;
    share_percentage: number;
    amount: number;
  }>;
  last_distribution: string;
}

export interface ContractInfo {
  address: string;
  tx_hash: string;
  block_number: number;
  creator: string;
  members: Array<{
    username: string;
    wallet_address: string;
    split_percentage: number;
  }>;
}

/**
 * Get earnings breakdown for a collaboration
 */
export async function getCollaborationEarnings(
  collaborationId: number,
): Promise<EarningsInfo> {
  return authenticatedFetchJson<EarningsInfo>(
    `/api/v1/collaborations/${collaborationId}/earnings/`,
    { method: "GET" }
  );
}

/**
 * Get smart contract details for a collaboration
 */
export async function getCollaborationContract(
  collaborationId: number,
): Promise<ContractInfo> {
  return authenticatedFetchJson<ContractInfo>(
    `/api/v1/collaborations/${collaborationId}/contract/`,
    { method: "GET" }
  );
}
