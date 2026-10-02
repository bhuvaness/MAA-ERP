/**
 * useVikiChat Hook
 * ================
 * Manages the Viki AI conversation flow:
 *   1. User describes their business
 *   2. Viki asks intent questions → builds BusinessProfile
 *   3. BusinessProfile gates which PTS nodes are in the active subgraph
 *   4. Viki queries Pinecone with flag-filtered results
 *   5. User drills into specific segments
 *
 * Phase machine:
 *   idle → thinking → intent_questions → responded → drilldown
 */

import { useState, useCallback } from "react";
import type { VikiResponse, GymSchemaInfo } from "../services/claudeService";
import {
  type BusinessProfile,
  type BusinessSettingsValue,
  loadBusinessSettingsValues,
  searchModules,
  extractSectorKeyword,
} from "../services/ptSearchService";

// ─── Types ────────────────────────────────────────────────────

export type VikiPhase =
  | "idle"             // Waiting for user input
  | "thinking"         // Calling Claude API / loading
  | "intent_questions" // Asking BusinessProfile flag questions
  | "responded"        // Got response, showing results
  | "drilldown"        // User is exploring a specific segment
  | "error";           // Something went wrong

export interface BusinessSettingsQuestion extends BusinessSettingsValue {
  answered: boolean;
  answer: boolean | null;
}

export interface VikiChatState {
  phase: VikiPhase;
  userPrompt: string;
  response: VikiResponse | null;
  /** @deprecated Always null now — use response.matchedModules instead.
   *  Kept to avoid breaking VikiBusinessChat UI until it is refactored
   *  to render generically from matchedModules. */
  gymSchema: GymSchemaInfo | null;
  selectedSegment: string | null;
  error: string | null;

  // BusinessProfile session state
  businessProfile: BusinessProfile | null;
  intentQuestions: BusinessSettingsQuestion[];
  currentQuestionIndex: number;

  // Actions
  submitPrompt: (prompt: string) => Promise<void>;
  answerIntentQuestion: (key: string, answer: boolean) => Promise<void>;
  selectSegment: (segmentName: string) => void;
  clearSegment: () => void;
  reset: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────

export function useVikiChat(): VikiChatState {
  const [phase, setPhase] = useState<VikiPhase>("idle");
  const [userPrompt, setUserPrompt] = useState("");
  const [response, setResponse] = useState<VikiResponse | null>(null);
  const [gymSchema, setGymSchema] = useState<GymSchemaInfo | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // BusinessProfile
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [intentQuestions, setIntentQuestions] = useState<BusinessSettingsQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Holds the prompt while intent questions are being answered
  const [pendingPrompt, setPendingPrompt] = useState("");

  /**
   * Step 1 — User submits their business description.
   * We start intent questions immediately; metadata search
   * runs after all questions are answered.
   */
  const submitPrompt = useCallback(async (prompt: string) => {
    setUserPrompt(prompt);
    setError(null);
    setSelectedSegment(null);
    setPendingPrompt(prompt);
    setBusinessProfile(null);

    // Detect sector from prompt to load only relevant flags
    const keyword = extractSectorKeyword(prompt);

    // Load intent flag nodes from VanakkamPayanarssTypes.json dynamically.
    // Filters by detected sector so a gym user only sees gym-relevant flags.
    // Falls back to all flags if no sector detected.
    let rawFlags: BusinessSettingsValue[] = [];
    try {
      rawFlags = await loadBusinessSettingsValues(
        keyword ? undefined : undefined, // sector filter once flags are authored
        undefined
      );
    } catch {
      // If JSON not available yet (no flags authored), proceed with empty set
      // — goes straight to search with no profile filtering
    }

    if (rawFlags.length === 0) {
      // No flags in JSON yet — skip questions and go straight to search
      setIntentQuestions([]);
      setCurrentQuestionIndex(0);
      setPendingPrompt(prompt);
      runSearch(prompt, { description: prompt, flags: {} });
      return;
    }

    const questions: BusinessSettingsQuestion[] = rawFlags.map((f) => ({
      ...f,
      answered: false,
      answer: null,
    }));

    setIntentQuestions(questions);
    setCurrentQuestionIndex(0);
    setPhase("intent_questions");
  }, []);

  /**
   * Step 2 — User answers one intent question (Yes / No).
   * When all are answered, build the BusinessProfile and run the search.
   */
  const answerIntentQuestion = useCallback(
    async (key: string, answer: boolean) => {
      setIntentQuestions((prev) => {
        const updated = prev.map((q) =>
          q.key === key ? { ...q, answered: true, answer } : q
        );

        const nextUnanswered = updated.findIndex((q) => !q.answered);

        if (nextUnanswered === -1) {
          // All answered — build profile and run search
          const flags: Record<string, boolean> = {};
          for (const q of updated) {
            flags[q.key] = q.answer === true;
          }

          const profile: BusinessProfile = {
            description: pendingPrompt,
            flags,
          };

          setBusinessProfile(profile);
          runSearch(pendingPrompt, profile);
        } else {
          setCurrentQuestionIndex(nextUnanswered);
        }

        return updated;
      });
    },
    [pendingPrompt]
  );

  /**
   * Step 3 — Run Pinecone search with the BusinessProfile.
   *
   * Fully generic — no sector-specific branching.
   * searchModules() handles sector detection internally via
   * detectSector() + extractSectorKeyword(). Every business type
   * — gym, restaurant, clinic, retail — goes through the same path.
   *
   * BusinessProfile flags filter the active subgraph so only
   * flag-matching nodes are returned for this specific company.
   */
  async function runSearch(prompt: string, profile: BusinessProfile) {
    setPhase("thinking");

    try {
      const keyword = extractSectorKeyword(prompt) ?? prompt;
      console.log("[useVikiChat] Searching Pinecone for:", keyword, "| flags:", profile.flags);

      const modules = await searchModules(keyword, 20, profile);
      console.log(`[useVikiChat] Pinecone returned ${modules.length} modules`);

      const vikiResponse: VikiResponse = {
        success: true,
        answer: modules.length > 0
          ? `Found ${modules.length} business modules from the PTS Library${
              Object.keys(profile.flags).length > 0
                ? `, filtered to match your business profile`
                : ""
            }.`
          : "I couldn't find modules matching your business profile. Try describing your business differently.",
        matchedModules: modules,
      };

      setResponse(vikiResponse);
      setPhase("responded");

    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setPhase("error");
    }
  }

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
    setBusinessProfile(null);
    setIntentQuestions([]);
    setCurrentQuestionIndex(0);
    setPendingPrompt("");
  }, []);

  return {
    phase,
    userPrompt,
    response,
    gymSchema,
    selectedSegment,
    error,
    businessProfile,
    intentQuestions,
    currentQuestionIndex,
    submitPrompt,
    answerIntentQuestion,
    selectSegment,
    clearSegment,
    reset,
  };
}
