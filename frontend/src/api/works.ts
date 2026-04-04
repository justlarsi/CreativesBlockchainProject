import { authenticatedFetch, authenticatedFetchJson } from "./interceptors";

function withAuthHeader(token: string | null | undefined, headers?: HeadersInit): Headers {
  const nextHeaders = new Headers(headers || {});
  if (token) {
    nextHeaders.set("Authorization", `Bearer ${token}`);
  }
  return nextHeaders;
}

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

export async function listWorks(token?: string): Promise<WorkRecord[]> {
  const data = await authenticatedFetchJson<{ results: WorkRecord[] }>(
    `/api/v1/works/`,
    {
      method: "GET",
      headers: withAuthHeader(token),
    }
  );
  return data.results || [];
}

export async function createWorkMetadata(
  tokenOrPayload: string | Pick<WorkRecord, "title" | "description" | "category">,
  maybePayload?: Pick<WorkRecord, "title" | "description" | "category">,
): Promise<WorkRecord> {
  const token = typeof tokenOrPayload === "string" ? tokenOrPayload : null;
  const payload = typeof tokenOrPayload === "string" ? maybePayload : tokenOrPayload;

  if (!payload) {
    throw new Error("Missing work metadata payload");
  }

  return authenticatedFetchJson<WorkRecord>(
    `/api/v1/works/`,
    {
      method: "POST",
      headers: withAuthHeader(token, { "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    }
  );
}

export async function uploadWorkBinary(
  tokenOrWorkId: string | number,
  workIdOrFile: number | File,
  maybeFile?: File,
): Promise<WorkRecord> {
  const token = typeof tokenOrWorkId === "string" ? tokenOrWorkId : null;
  const workId = typeof tokenOrWorkId === "string" ? (workIdOrFile as number) : tokenOrWorkId;
  const file = typeof tokenOrWorkId === "string" ? maybeFile : (workIdOrFile as File);

  if (!file) {
    throw new Error("Missing file for upload");
  }

  const body = new FormData();
  body.append("file", file);

  const response = await authenticatedFetch(
    `/api/v1/works/${workId}/upload/`,
    {
      method: "PUT",
      headers: withAuthHeader(token),
      body,
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.detail || data?.error || "Upload failed");
  }

  return data as WorkRecord;
}

export async function prepareBlockchainRegistration(
  tokenOrWorkId: string | number,
  maybeWorkId?: number,
): Promise<BlockchainTxPayload> {
  const token = typeof tokenOrWorkId === "string" ? tokenOrWorkId : null;
  const workId = typeof tokenOrWorkId === "string" ? maybeWorkId : tokenOrWorkId;

  if (!workId) {
    throw new Error("Missing work id");
  }

  return authenticatedFetchJson<BlockchainTxPayload>(
    `/api/v1/works/${workId}/register-blockchain/prepare/`,
    {
      method: "POST",
      headers: withAuthHeader(token, { "Content-Type": "application/json" }),
      body: JSON.stringify({}),
    }
  );
}

export async function submitBlockchainReceipt(
  tokenOrWorkId: string | number,
  workIdOrTxHash: number | string,
  maybeTxHash?: string,
): Promise<BlockchainReceiptQueuedResponse> {
  const token = typeof tokenOrWorkId === "string" ? tokenOrWorkId : null;
  const workId = typeof tokenOrWorkId === "string" ? (workIdOrTxHash as number) : tokenOrWorkId;
  const txHash = typeof tokenOrWorkId === "string" ? maybeTxHash : (workIdOrTxHash as string);

  if (!txHash) {
    throw new Error("Missing transaction hash");
  }

  return authenticatedFetchJson<BlockchainReceiptQueuedResponse>(
    `/api/v1/works/${workId}/register-blockchain/receipt/`,
    {
      method: "POST",
      headers: withAuthHeader(token, { "Content-Type": "application/json" }),
      body: JSON.stringify({ tx_hash: txHash }),
    }
  );
}

export interface UpdateWorkMetadataPayload {
  title?: string;
  description?: string;
  category?: string;
}

/**
 * Update work metadata (title, description, category)
 */
export async function updateWorkMetadata(
  workId: number,
  payload: UpdateWorkMetadataPayload,
): Promise<WorkRecord> {
  return authenticatedFetchJson<WorkRecord>(
    `/api/v1/works/${workId}/`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
}

/**
 * Get detailed information about a work
 */
export async function getWorkDetails(workId: number): Promise<WorkRecord> {
  return authenticatedFetchJson<WorkRecord>(
    `/api/v1/works/${workId}/`,
    { method: "GET" }
  );
}

/**
 * Download work certificate (proof of registration)
 */
export async function downloadWorkCertificate(workId: number): Promise<Blob> {
  const response = await authenticatedFetch(
    `/api/v1/works/${workId}/certificate/`,
    { method: "GET" }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.detail || "Failed to download certificate");
  }

  return response.blob();
}
