import { supabase } from "@/integrations/supabase/client";
import { PayanarssType } from "@/types/PayanarssType";

const PINECONE_INDEX_HOST = "maa-erp-types-y3f7eec.svc.aped-4627-b74a.pinecone.io";

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
    description: string;
    // Hierarchy
    level: string;          // sector|module|submodule|usecase|table
    sector: string;         // "Personal Services"
    module: string;         // "Gym & Fitness Center"
    submodule: string;      // "Membership Management"
    usecase: string;        // "Member Registration"
    path: string;           // "MAA ERP > Personal Services > Gym... > Table"
    is_common: boolean;     // true if under Common Modules
    // Relations
    parent_name: string;
    child_count: number;
    // Table-specific
    column_names: string;   // comma-separated column names
    column_types: string;   // comma-separated types (STRING, LOOKUP, DATE...)
    column_count: number;
    table_count: number;    // how many tables under this node
    // Debug
    embedding_text: string;
  };
}

export interface QueryResponse {
  success: boolean;
  query: string;
  detectedSector?: string;
  searchMethod?: string;
  results: QueryResult[];
  aiSummary: string;
  error?: string;
}

export interface EmbedResponse {
  success: boolean;
  totalProcessed: number;
  totalSkipped?: number;
  method?: string;
  batches: Array<{
    batch: number;
    count: number;
    upserted: number;
  }>;
  error?: string;
}

/**
 * Embed all PayanarssTypes into Pinecone Vector DB
 * The edge function handles:
 * - Hierarchy extraction (sector > module > submodule > usecase > table)
 * - Selective embedding (only sector/module/submodule/usecase/table levels)
 * - Rich metadata (column names, types, paths, is_common flag)
 * - Integrated inference or fallback embedding
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
 * Query Pinecone for matching PayanarssTypes based on user requirements.
 * Supports:
 * - Natural language queries ("I need gym membership management")
 * - Sector filtering (auto-detected or manual)
 * - Level filtering (module, table, usecase, etc.)
 */
export async function queryTypes(
  query: string,
  topK: number = 15,
  options?: {
    sectorFilter?: string;
    levelFilter?: string;
  }
): Promise<QueryResponse> {
  try {
    const { data, error } = await supabase.functions.invoke<QueryResponse>(
      "query-types",
      {
        body: {
          query,
          indexHost: PINECONE_INDEX_HOST,
          topK,
          sectorFilter: options?.sectorFilter,
          levelFilter: options?.levelFilter,
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

/**
 * Get business configuration — returns full PayanarssType tree
 * for selected modules (used by MAA ERP at runtime)
 */
export async function getBusinessConfig(
  selectedModuleIds: string[],
  businessType: string
): Promise<{
  success: boolean;
  businessType: string;
  commonModules: QueryResult[];
  selectedModules: QueryResult[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "get-business-config",
      {
        body: {
          selectedModuleIds,
          businessType,
          indexHost: PINECONE_INDEX_HOST,
        },
      }
    );

    if (error) throw new Error(error.message);
    return data;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return {
      success: false,
      businessType,
      commonModules: [],
      selectedModules: [],
      error: errorMessage,
    };
  }
}
