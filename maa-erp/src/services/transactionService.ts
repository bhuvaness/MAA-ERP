/**
 * transactionService.ts
 * =====================
 * Frontend service — call from your MAA ERP React app.
 * Drop into: src/services/transactionService.ts
 */

export interface SaveTransactionPayload {
  payanarssTypeId: string;
  data: Record<string, unknown>;
}

export interface SaveTransactionResponse {
  success: boolean;
  transactionId: string;
  payanarssTypeId: string;
  timestamp: string;
  filePath: string;
}

// Change this if your Express server runs on a different port
const API_BASE = 'http://localhost:3001/api';

/**
 * Save a transaction record to the server.
 *
 * Usage:
 *   const result = await saveTransaction({
 *     payanarssTypeId: 'FreeWeightProcurement',
 *     data: { EquipmentCategory: 'Heavy Free Weights', Brand: 'Rogue', ... }
 *   });
 */
export async function saveTransaction(
  payload: SaveTransactionPayload
): Promise<SaveTransactionResponse> {
  const res = await fetch(`${API_BASE}/transactions/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }

  return res.json();
}

/**
 * Fetch all saved records for a PayanarssTypeId.
 */
export async function getTransactions(payanarssTypeId: string) {
  const res = await fetch(`${API_BASE}/transactions/${encodeURIComponent(payanarssTypeId)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json();
}
