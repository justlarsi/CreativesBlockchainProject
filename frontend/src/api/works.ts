export interface ContentHash {
  id: number;
  hash_type: "sha256" | "perceptual_avg" | "text_normalized";
  hash_value: string;
  created_at: string;
}

export interface WorkRecord {
  id: number;
  owner_id: number;
  title: string;
  description: string;
  category: "image" | "audio" | "video" | "text" | "document";
  status:
    | "PENDING_UPLOAD"
    | "UPLOADED"
    | "VALIDATION_FAILED"
    | "UPLOAD_FAILED"
    | "PROCESSING"
    | "PROCESSING_COMPLETE"
    | "PROCESSING_FAILED"
    | "IPFS_PINNING_COMPLETE"
    | "IPFS_PINNING_FAILED"
    | "BLOCKCHAIN_REGISTRATION_PENDING"
    | "BLOCKCHAIN_REGISTRATION_FAILED"
    | "REGISTERED";
  original_filename: string;
  file_size: number | null;
  mime_type: string;
  ipfs_metadata_cid: string;
  blockchain_tx_hash: string;
  blockchain_block_number: number | null;
  blockchain_registration_timestamp: string | null;
  blockchain_error_message: string;
  file: string | null;
  content_hashes: ContentHash[];
  created_at: string;
  updated_at: string;
}

export interface BlockchainTxPayload {
  to: string;
  data: string;
}

export interface BlockchainReceiptQueuedResponse {
  status: "BLOCKCHAIN_REGISTRATION_PENDING";
  tx_hash: string;
  explorer_url: string;
  message: string;
  max_retries: number;
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
    return "Works API request failed.";
  }

  const payload = data as Record<string, unknown>;
  const errorPayload = payload.error as Record<string, unknown> | undefined;
  if (errorPayload && typeof errorPayload.message === "string") {
    return errorPayload.message;
  }

  if (typeof payload.detail === "string") {
    return payload.detail;
  }

  return "Works API request failed.";
}

async function parseJsonOrThrow(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(extractErrorMessage(data));
  }
  return data;
}

export async function listWorks(accessToken: string): Promise<WorkRecord[]> {
  const response = await fetch(`${apiBase}/api/v1/works/`, {
    method: "GET",
    headers: getAuthHeaders(accessToken),
  });
  const data = await parseJsonOrThrow(response);
  return data.results || [];
}

export async function createWorkMetadata(
  accessToken: string,
  payload: Pick<WorkRecord, "title" | "description" | "category">,
): Promise<WorkRecord> {
  const response = await fetch(`${apiBase}/api/v1/works/`, {
    method: "POST",
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow(response);
}

export async function uploadWorkBinary(accessToken: string, workId: number, file: File): Promise<WorkRecord> {
  const body = new FormData();
  body.append("file", file);

  const response = await fetch(`${apiBase}/api/v1/works/${workId}/upload/`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body,
  });
  return parseJsonOrThrow(response);
}

export async function prepareBlockchainRegistration(
  accessToken: string,
  workId: number,
): Promise<BlockchainTxPayload> {
  const response = await fetch(`${apiBase}/api/v1/works/${workId}/register-blockchain/prepare/`, {
    method: "POST",
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify({}),
  });
  return parseJsonOrThrow(response);
}

export async function submitBlockchainReceipt(
  accessToken: string,
  workId: number,
  txHash: string,
): Promise<BlockchainReceiptQueuedResponse> {
  const response = await fetch(`${apiBase}/api/v1/works/${workId}/register-blockchain/receipt/`, {
    method: "POST",
    headers: getAuthHeaders(accessToken),
    body: JSON.stringify({ tx_hash: txHash }),
  });
  return parseJsonOrThrow(response);
}

