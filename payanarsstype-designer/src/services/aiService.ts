import { supabase } from "@/integrations/supabase/client";

export interface GeneratedField {
  name: string;
  type: string;
  description: string;
}

export interface GenerateTypesResponse {
  fields: GeneratedField[];
}

export interface GenerateTypesError {
  error: string;
}

export async function generateTypes(
  prompt: string,
  parentName?: string
): Promise<GeneratedField[]> {
  const { data, error } = await supabase.functions.invoke<GenerateTypesResponse | GenerateTypesError>(
    "generate-types",
    {
      body: { prompt, parentName },
    }
  );

  if (error) {
    console.error("Edge function invocation error:", error);
    throw new Error(error.message || "Failed to connect to AI service");
  }

  if (!data) {
    throw new Error("No response from AI service");
  }

  // Check if the response is an error
  if ("error" in data) {
    throw new Error(data.error);
  }

  if (!data.fields || !Array.isArray(data.fields)) {
    throw new Error("Invalid response format from AI");
  }

  return data.fields;
}
