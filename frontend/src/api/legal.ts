import { authenticatedFetchJson, authenticatedFetch } from "./interceptors";

export interface LegalDocument {
  id: number;
  document_type: "dmca" | "cease_and_desist";
  work_id: number;
  work_title: string;
  alert_id: number | null;
  alert_status: string | null;
  file: string;
  proof_snapshot: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export async function listLegalDocuments(): Promise<LegalDocument[]> {
  const data = await authenticatedFetchJson<{ results: LegalDocument[] }>(
    `/api/v1/legal/documents/`,
    { method: "GET" }
  );
  return data.results || [];
}

export async function getLegalDocument(documentId: number): Promise<LegalDocument> {
  return authenticatedFetchJson<LegalDocument>(
    `/api/v1/legal/documents/${documentId}/`,
    { method: "GET" }
  );
}

export async function downloadLegalDocument(documentId: number): Promise<Blob> {
  const response = await authenticatedFetch(
    `/api/v1/legal/documents/${documentId}/download/`,
    { method: "GET" }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.detail || "Failed to download document");
  }

  return response.blob();
}

export async function generateLegalDocument(payload: {
  document_type: "dmca" | "cease_and_desist";
  work_id: number;
  alert_id?: number | null;
}): Promise<LegalDocument> {
  return authenticatedFetchJson<LegalDocument>(
    `/api/v1/legal/documents/generate/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
}

