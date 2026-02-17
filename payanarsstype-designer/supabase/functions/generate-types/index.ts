import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, parentName } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ error: "Prompt is required and must be a string" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      console.error("ANTHROPIC_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service is not configured. Please add your Anthropic API key." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are a data modeling assistant that helps generate PayanarssType field definitions.
When given a description, generate appropriate field names and types for a data model.

Respond with a JSON array of field objects. Each field should have:
- name: The field name in PascalCase (e.g., "FirstName", "EmailAddress")
- type: The data type (String, Integer, Decimal, Boolean, DateTime, Date, Text, Email, Phone, Currency, Percentage, URL)
- description: A brief description of the field

${parentName ? `The fields will be children of "${parentName}".` : "These will be root-level type definitions."}

Only respond with valid JSON. Do not include any explanation or markdown formatting.

Example response:
[
  {"name": "FirstName", "type": "String", "description": "Customer's first name"},
  {"name": "LastName", "type": "String", "description": "Customer's last name"},
  {"name": "Email", "type": "Email", "description": "Primary email address"}
]`;

    console.log("Sending request to Anthropic API...");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-20250514",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error("Rate limit exceeded");
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to generate types. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("Anthropic response received successfully");

    const content = data.content?.[0]?.text;
    if (!content) {
      console.error("No content in Anthropic response");
      return new Response(
        JSON.stringify({ error: "No response from AI. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the JSON response from AI
    let fields;
    try {
      const cleanContent = content.replace(/```json\n?|\n?```/g, "").trim();
      fields = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ fields }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
