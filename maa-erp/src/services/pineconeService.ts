/**
 * pineconeService.ts  (frontend)
 * ==============================
 * Call from React / useChat.ts to search Pinecone via the Express API.
 * Place in: src/services/pineconeService.ts
 */

export interface PineconeMatch {
  payanarssTypeId: string;
  score: number;
  metadata: {
    name:        string;
    description: string;
    category:    string;
    type:        string;
    parentName:  string;
  };
}

export interface PineconeSearchResult {
  query:   string;
  model:   string;
  index:   string;
  topK:    number;
  matches: PineconeMatch[];
}

const API_BASE = 'http://localhost:3001/api';

export async function semanticSearch(
  prompt: string,
  topK = 5
): Promise<PineconeSearchResult> {
  const res = await fetch(`${API_BASE}/search`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ prompt, topK }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }

  const json = await res.json();
  return json as PineconeSearchResult;
}
