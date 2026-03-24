/**
 * Claude AI Service — Direct Browser → Claude API
 * ================================================
 * Sends full PayanarssType metadata + user prompt to Claude.
 * Claude reads the metadata and returns relevant business types.
 *
 * Flow:
 *   1. Load all PayanarssTypes (cached)
 *   2. Build compact representation (~38K tokens)
 *   3. Send to Claude with user's business description
 *   4. Return structured response with matched types
 */

import { PayanarssType } from "../types/core";
import { fetchAllTypes } from "./payanarssTypeService";
import {
  HierarchyIndex,
  buildHierarchyIndex,
  getChildren,
  getNodeById,
  getAncestorPath,
} from "../utils/hierarchyBuilder";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface VikiResponse {
  success: boolean;
  answer: string;
  matchedModules: MatchedModule[];
  gymSchema?: GymSchemaInfo;
  error?: string;
}

export interface MatchedModule {
  id: string;
  name: string;
  level: string;
  sector: string;
  description: string;
  children?: string[];
}

export interface GymSchemaInfo {
  phases: { name: string; nodeCount: number; children: string[] }[];
  customerSegments: { name: string; description: string; subCategories: string[] }[];
  totalNodes: number;
}

// ═══════════════════════════════════════════════════════════════
// COMPACT TREE BUILDER — Converts 13,500 nodes to ~38K tokens
// ═══════════════════════════════════════════════════════════════

function getPrefix(id: string): string {
  return id.substring(0, 3).toUpperCase();
}

function findAncestorName(
  nodeId: string,
  targetPrefixes: string[],
  byId: Map<string, PayanarssType>
): string {
  let current = byId.get(nodeId);
  const visited = new Set<string>();
  while (current && !visited.has(current.Id)) {
    visited.add(current.Id);
    if (targetPrefixes.includes(getPrefix(current.Id))) return current.Name;
    if (!current.ParentId || current.ParentId === current.Id) break;
    current = byId.get(current.ParentId);
  }
  return "";
}

/**
 * Build compact text of all PayanarssTypes for Claude's context.
 * Format: level|Name|Sector|Module|Description|cols:Col1,Col2,...
 */
export function buildCompactTree(allTypes: PayanarssType[]): string {
  const byId = new Map(allTypes.map((t) => [t.Id, t]));
  const childrenMap = new Map<string, PayanarssType[]>();
  for (const t of allTypes) {
    if (t.ParentId && t.ParentId !== t.Id) {
      if (!childrenMap.has(t.ParentId)) childrenMap.set(t.ParentId, []);
      childrenMap.get(t.ParentId)!.push(t);
    }
  }

  const levelMap: Record<string, string> = {
    SEC: "sector", MOD: "module", ISM: "module",
    SMO: "submodule", SUB: "submodule",
    UCX: "usecase", TBL: "table",
  };

  const embeddable = new Set(["SEC", "MOD", "ISM", "SMO", "SUB", "UCX", "TBL"]);
  const lines: string[] = [];

  for (const node of allTypes) {
    const prefix = getPrefix(node.Id);
    if (!embeddable.has(prefix)) continue;

    const level = levelMap[prefix] || "other";
    const desc = (node.Description || "").substring(0, 100);
    const sector = findAncestorName(node.ParentId, ["SEC"], byId);
    const module = findAncestorName(node.ParentId, ["MOD", "ISM"], byId);

    if (prefix === "TBL") {
      const cols = (childrenMap.get(node.Id) || [])
        .filter((c) => getPrefix(c.Id) === "COL")
        .map((c) => c.Name);
      lines.push(`${level}|${node.Name}|${sector}|${module}|${desc}|cols:${cols.join(",")}`);
    } else if (prefix === "SEC") {
      const modules = (childrenMap.get(node.Id) || []).map((c) => c.Name);
      lines.push(`${level}|${node.Name}|${desc}|modules:${modules.join(",")}`);
    } else {
      lines.push(`${level}|${node.Name}|${sector}|${module}|${desc}`);
    }
  }

  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════
// EXTRACT GYM METADATA — Pull gym-specific data from the tree
// ═══════════════════════════════════════════════════════════════

export function extractGymMetadata(
  allTypes: PayanarssType[],
  index: HierarchyIndex
): GymSchemaInfo | null {
  // Find "Gym Business DB Schema"
  const gymSchema = allTypes.find((t) => t.Name === "Gym Business DB Schema");
  if (!gymSchema) return null;

  const phases: GymSchemaInfo["phases"] = [];
  const schemaChildren = getChildren(index, gymSchema.Id);

  for (const phase of schemaChildren) {
    const phaseChildren = getChildren(index, phase.Id);
    phases.push({
      name: phase.Name,
      nodeCount: phaseChildren.length,
      children: phaseChildren.map((c) => c.Name),
    });
  }

  // Find customer segments
  const segmentParent = allTypes.find(
    (t) => t.Name === "Identify Target Customer Segment"
  );
  const customerSegments: GymSchemaInfo["customerSegments"] = [];

  if (segmentParent) {
    const segments = getChildren(index, segmentParent.Id);
    for (const seg of segments) {
      const subs = getChildren(index, seg.Id);
      customerSegments.push({
        name: seg.Name,
        description: seg.Description || "",
        subCategories: subs.map((s) => `${s.Name}: ${(s.Description || "").substring(0, 80)}`),
      });
    }
  }

  // Count total gym nodes
  function countAll(parentId: string): number {
    const children = getChildren(index, parentId);
    let count = children.length;
    for (const c of children) count += countAll(c.Id);
    return count;
  }

  return {
    phases,
    customerSegments,
    totalNodes: countAll(gymSchema.Id) + 1,
  };
}

// ═══════════════════════════════════════════════════════════════
// CLAUDE API CALL
// ═══════════════════════════════════════════════════════════════

export async function queryViki(
  userPrompt: string
): Promise<VikiResponse> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      answer: "",
      matchedModules: [],
      error: "VITE_ANTHROPIC_API_KEY not set in .env file. Get your key from console.anthropic.com",
    };
  }

  try {
    // 1. Load all types + build index
    const allTypes = await fetchAllTypes();
    const index = buildHierarchyIndex(allTypes);

    // 2. Build compact tree for Claude
    const compactTree = buildCompactTree(allTypes);

    // 3. Extract gym metadata (for structured display)
    const gymData = extractGymMetadata(allTypes, index);

    // 4. Call Claude
    const systemPrompt = `You are Viki, the AI assistant for MAA ERP — powered by Payanarss Type Script (PTS).

You have the COMPLETE PayanarssType metadata library. Each line is:
- Format: level|Name|Sector|Module|Description|cols:Column1,Column2,...
- Levels: sector, module, submodule, usecase, table
- Tables include column names

When a user describes their business:
1. Identify which SECTOR(s) match their business
2. List the specific MODULES from the library that are relevant
3. Highlight key USE CASES they will need
4. For Gym businesses, always include "Gym Business DB Schema" and "Identify Target Customer Segment"
5. Always include relevant Common Modules (HR, Finance, Payroll, Procurement)

Respond in JSON ONLY (no markdown, no backticks):
{
  "answer": "Your friendly recommendation explaining what you found (2-3 paragraphs, mention specific module names and use cases from the library)",
  "matchedModules": [
    {
      "id": "approximate-id",
      "name": "Exact Module Name from library",
      "level": "sector|module|submodule|usecase",
      "sector": "Sector Name",
      "description": "Why this module is relevant to the user's business",
      "children": ["Child1 Name", "Child2 Name"]
    }
  ]
}

Be specific — use ACTUAL names from the library. If the user mentions gym/fitness, always return the full Gym Business DB Schema hierarchy including the customer segments (Bodybuilders, General Fitness, Women-Only, CrossFit, etc).`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 3000,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Here is the complete PTS Library:\n\n${compactTree}\n\n---\n\nUser says: "${userPrompt}"\n\nAnalyze the library and recommend the best modules. JSON only.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Claude API error (${response.status}): ${errText.substring(0, 200)}`);
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text || "";

    let parsed;
    try {
      const clean = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      parsed = { answer: rawText, matchedModules: [] };
    }

    return {
      success: true,
      answer: parsed.answer || rawText,
      matchedModules: parsed.matchedModules || [],
      gymSchema: gymData || undefined,
    };
  } catch (err) {
    return {
      success: false,
      answer: "",
      matchedModules: [],
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// DIRECT METADATA LOOKUP — No Claude needed for known patterns
// ═══════════════════════════════════════════════════════════════

/**
 * Fast path: if user mentions "gym", directly extract gym metadata
 * without calling Claude API. For known business types only.
 */
export async function getGymMetadataDirect(): Promise<{
  gymSchema: GymSchemaInfo | null;
  matchedTypes: PayanarssType[];
}> {
  const allTypes = await fetchAllTypes();
  const index = buildHierarchyIndex(allTypes);
  const gymSchema = extractGymMetadata(allTypes, index);

  // Collect all gym-related types
  const gymKeywords = ["gym", "fitness", "member", "trainer", "workout", "class"];
  const matchedTypes = allTypes.filter((t) => {
    const name = t.Name.toLowerCase();
    const desc = (t.Description || "").toLowerCase();
    const prefix = getPrefix(t.Id);
    // Only return ISM, SMO, UCX, TBL level nodes
    if (!["ISM", "SMO", "SUB", "UCX", "TBL"].includes(prefix)) return false;
    return gymKeywords.some((kw) => name.includes(kw) || desc.includes(kw));
  });

  return { gymSchema, matchedTypes };
}
