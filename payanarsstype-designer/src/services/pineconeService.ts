import { supabase } from "@/integrations/supabase/client";
import { PayanarssType } from "@/types/PayanarssType";

const PINECONE_INDEX_HOST = "payanarss-type-y3f7eec.svc.aped-4627-b74a.pinecone.io";

export interface EmbedProgress {
  totalTypes: number;
  processedBatches: number;
  totalBatches: number;
  status: "idle" | "embedding" | "complete" | "error";
  error?: string;
}

export interface QueryResult {
  id: string;
  score: number;
  metadata: {
    name: string;
    parentId: string;
    payanarssTypeId: string;
    description: string;
    hasAttributes: boolean;
    // Enriched metadata fields
    domain?: string;
    purpose?: string;
    module?: string;
    keywords?: string;
    parentName?: string;
    childCount?: number;
  };
}

export interface QueryResponse {
  success: boolean;
  query: string;
  detectedDomain?: string;
  results: QueryResult[];
  aiSummary: string;
  error?: string;
}

export interface EmbedResponse {
  success: boolean;
  totalProcessed: number;
  batches: Array<{
    batch: number;
    count: number;
    upserted: number;
  }>;
  error?: string;
}

/**
 * Embed all PayanarssTypes into Pinecone Vector DB
 */
export async function embedTypes(
  types: PayanarssType[],
  onProgress?: (progress: EmbedProgress) => void
): Promise<EmbedResponse> {
  const totalBatches = Math.ceil(types.length / 50);
  
  onProgress?.({
    totalTypes: types.length,
    processedBatches: 0,
    totalBatches,
    status: "embedding",
  });

  try {
    const { data, error } = await supabase.functions.invoke<EmbedResponse>(
      "embed-types",
      {
        body: {
          types,
          indexHost: PINECONE_INDEX_HOST,
        },
      }
    );

    if (error) {
      throw new Error(error.message || "Failed to embed types");
    }

    if (!data) {
      throw new Error("No response from embedding service");
    }

    if (!data.success && data.error) {
      throw new Error(data.error);
    }

    onProgress?.({
      totalTypes: types.length,
      processedBatches: totalBatches,
      totalBatches,
      status: "complete",
    });

    return data;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    
    onProgress?.({
      totalTypes: types.length,
      processedBatches: 0,
      totalBatches,
      status: "error",
      error: errorMessage,
    });

    throw err;
  }
}

/**
 * Query Pinecone for matching PayanarssTypes based on user requirements
 */
export async function queryTypes(
  query: string,
  topK: number = 10
): Promise<QueryResponse> {
  try {
    const { data, error } = await supabase.functions.invoke<QueryResponse>(
      "query-types",
      {
        body: {
          query,
          indexHost: PINECONE_INDEX_HOST,
          topK,
        },
      }
    );

    if (error) {
      throw new Error(error.message || "Failed to query types");
    }

    if (!data) {
      throw new Error("No response from query service");
    }

    if (!data.success && data.error) {
      throw new Error(data.error);
    }

    return data;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return {
      success: false,
      query,
      results: [],
      aiSummary: "",
      error: errorMessage,
    };
  }
}

/**
 * Load PayanarssTypes from JSON file
 */
export async function loadPayanarssTypes(): Promise<PayanarssType[]> {
  const response = await fetch("/data/VanakkamPayanarssTypes.json");
  if (!response.ok) {
    throw new Error("Failed to load PayanarssTypes");
  }
  return response.json();
}
