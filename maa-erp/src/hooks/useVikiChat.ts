/**
 * useVikiChat Hook
 * ================
 * Manages the Viki AI conversation flow:
 *   1. User describes their business
 *   2. Viki reads PTS metadata via Claude API
 *   3. Returns matched modules + customer segments
 *   4. User drills into specific segments
 *
 * Two modes:
 *   - FAST: keyword detection → direct metadata lookup (no API call)
 *   - FULL: Claude API → reads full PTS library → returns structured response
 */

import { useState, useCallback } from "react";
import {
  queryViki,
  getGymMetadataDirect,
  type VikiResponse,
  type GymSchemaInfo,
} from "../services/claudeService";

export type VikiPhase =
  | "idle"          // Waiting for user input
  | "thinking"      // Calling Claude API
  | "responded"     // Got response, showing results
  | "drilldown"     // User is exploring a specific segment
  | "error";        // Something went wrong

export interface VikiChatState {
  phase: VikiPhase;
  userPrompt: string;
  response: VikiResponse | null;
  gymSchema: GymSchemaInfo | null;
  selectedSegment: string | null;
  error: string | null;

  // Actions
  submitPrompt: (prompt: string) => Promise<void>;
  selectSegment: (segmentName: string) => void;
  clearSegment: () => void;
  reset: () => void;
}

export function useVikiChat(): VikiChatState {
  const [phase, setPhase] = useState<VikiPhase>("idle");
  const [userPrompt, setUserPrompt] = useState("");
  const [response, setResponse] = useState<VikiResponse | null>(null);
  const [gymSchema, setGymSchema] = useState<GymSchemaInfo | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Submit the user's business description to Viki.
   *
   * Fast path: if "gym" is mentioned, directly extract metadata.
   * Full path: send to Claude API for analysis.
   */
  const submitPrompt = useCallback(async (prompt: string) => {
    setUserPrompt(prompt);
    setPhase("thinking");
    setError(null);
    setSelectedSegment(null);

    try {
      const lowerPrompt = prompt.toLowerCase();
      const isGym =
        lowerPrompt.includes("gym") ||
        lowerPrompt.includes("fitness") ||
        lowerPrompt.includes("workout");

      if (isGym) {
        // ── FAST PATH: Direct metadata extraction ──
        console.log("🏋️ Gym detected — using fast path (direct metadata)");
        const { gymSchema: schema } = await getGymMetadataDirect();
        setGymSchema(schema);

        // Also call Claude for the natural language response
        const vikiResponse = await queryViki(prompt);
        setResponse(vikiResponse);

        if (vikiResponse.success) {
          // Override gymSchema with the extracted one (more complete)
          if (schema) {
            vikiResponse.gymSchema = schema;
          }
          setPhase("responded");
        } else {
          // Even if Claude fails, we have the direct metadata
          setResponse({
            success: true,
            answer: `Great! I found the complete Gym Business metadata in our PTS Library. Here's what's available for your gym business:

The Gym Business DB Schema contains ${schema?.totalNodes || 400} pre-built types organized into ${schema?.phases.length || 15} lifecycle phases — from defining your business vision to daily operations and compliance.

Under "Identify Target Customer Segment", we have ${schema?.customerSegments.length || 10} pre-configured gym types, each with tailored Equipment, Staffing, Facility, Marketing, Pricing, and Revenue Model recommendations.

Select a customer segment below to see the full business configuration for your gym type.`,
            matchedModules: [],
            gymSchema: schema || undefined,
          });
          setPhase("responded");
        }
      } else {
        // ── FULL PATH: Claude API ──
        console.log("🤖 Using Claude API for analysis");
        const vikiResponse = await queryViki(prompt);
        setResponse(vikiResponse);

        if (vikiResponse.success) {
          setGymSchema(vikiResponse.gymSchema || null);
          setPhase("responded");
        } else {
          setError(vikiResponse.error || "Failed to get response");
          setPhase("error");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setPhase("error");
    }
  }, []);

  const selectSegment = useCallback((segmentName: string) => {
    setSelectedSegment(segmentName);
    setPhase("drilldown");
  }, []);

  const clearSegment = useCallback(() => {
    setSelectedSegment(null);
    setPhase("responded");
  }, []);

  const reset = useCallback(() => {
    setPhase("idle");
    setUserPrompt("");
    setResponse(null);
    setGymSchema(null);
    setSelectedSegment(null);
    setError(null);
  }, []);

  return {
    phase,
    userPrompt,
    response,
    gymSchema,
    selectedSegment,
    error,
    submitPrompt,
    selectSegment,
    clearSegment,
    reset,
  };
}
