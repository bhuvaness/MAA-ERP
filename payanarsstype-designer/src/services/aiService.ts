/**
 * aiService.ts
 * ============
 * Calls the Anthropic Claude API directly from the browser.
 *
 * SETUP: Add this to your .env file:
 *   VITE_ANTHROPIC_API_KEY=sk-ant-...
 *
 * NOTE: For a production multi-user app, move this call to a backend proxy
 * so the API key is never shipped in the client bundle.
 * For an internal/developer tool like PayanarssType Designer, calling
 * from the browser with an env-var key is acceptable.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GeneratedField {
  name: string;
  /**
   * One of: GroupType | TableType | ChildTableType | LookupType |
   *         ValueType | AttributeType | BusinessUseCase
   */
  type: string;
  description: string;
  /** Optional nested children — e.g. column ValueTypes under a TableType */
  children?: GeneratedField[];
}

export interface GenerateTypesResponse {
  fields: GeneratedField[];
}

export interface GenerateTypesError {
  error: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

// Compact PayanarssType shape — only what we need to send to Claude
export interface PayanarssTypeSummary {
  Id: string;
  ParentId: string;
  Name: string;
  PayanarssTypeId: string;
  Description: string | null;
}

/**
 * Allowed PayanarssType node types the AI can assign.
 * Maps to ROOT_TYPE_IDS in PayanarssType.ts.
 */
const VALID_TYPES = [
  "GroupType",        // Logical grouping / module (no data rows)
  "TableType",        // Primary entity table (has rows)
  "ChildTableType",   // Child / line-item table (belongs to a TableType)
  "LookupType",       // Reference / lookup table
  "ValueType",        // Scalar field / attribute
  "AttributeType",    // Typed attribute (with its own sub-attributes)
  "BusinessUseCase",  // Top-level business use case node
] as const;

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  const types = VALID_TYPES.join(", ");
  return `You are an expert ERP architect helping design PayanarssType metadata structures.

PayanarssType is a recursive metadata system. Every ERP entity, module, field, and business
concept is a node. Each node has a Name, a Type, and a Description.

Available types:
- BusinessUseCase : A business activity/step (e.g. "ScheduleAppointment", "OnboardEmployee")
- GroupType       : A logical grouping/module holding other nodes (e.g. "HRModule")
- TableType       : A primary data entity/table (e.g. "Employee", "Invoice")
- ChildTableType  : A child/line-item table belonging to a TableType (e.g. "InvoiceLine")
- LookupType      : A reference/lookup list (e.g. "Department", "Country")
- AttributeType   : A typed attribute group with sub-attributes (e.g. "Address")
- ValueType       : A scalar leaf field (e.g. "EmployeeName", "JoinDate", "Email")

⚠️ MANDATORY OUTPUT RULE — NEVER SKIP CHILDREN:
Every TableType, ChildTableType, and LookupType node MUST include a "children" array
with 5–12 relevant ValueType column fields. A table node with an empty or missing
"children" array is INVALID and will be rejected.

RESPONSE FORMAT — return ONLY valid JSON, no markdown, no explanation:
{
  "fields": [
    {
      "name": "CleaningCrewAssignment",
      "type": "TableType",
      "description": "Records crew assignments to appointments.",
      "children": [
        { "name": "AssignmentId",     "type": "ValueType", "description": "Unique assignment identifier." },
        { "name": "AppointmentId",    "type": "ValueType", "description": "Linked appointment reference." },
        { "name": "CrewMemberId",     "type": "ValueType", "description": "Assigned crew member ID." },
        { "name": "AssignedDate",     "type": "ValueType", "description": "Date crew was assigned." },
        { "name": "AssignmentStatus", "type": "ValueType", "description": "Current status of assignment." },
        { "name": "Notes",            "type": "ValueType", "description": "Additional assignment notes." }
      ]
    }
  ]
}
Rules:
1. Use PascalCase for all names — no spaces.
2. Type must be exactly one of: ${types}.
3. Descriptions must be concise, under 15 words.
4. No duplicate names.
5. Return ONLY the JSON object — no prose, no code fences.
6. ⚠️ EVERY TableType/ChildTableType/LookupType MUST have a "children" array with 5–12 ValueType columns.
7. ValueType fields go INSIDE their parent table's "children" — NEVER as top-level "fields" array items.
8. A BusinessUseCase may contain TableType children; each TableType MUST have its own ValueType children.
9. GroupType nodes contain TableType or BusinessUseCase children — never bare ValueTypes.
10. If the user asks for "tables, columns, and rules" — columns = ValueType children inside the table.`;
}

function buildUserPrompt(
  prompt: string,
  parentName?: string,
  parentTypeName?: string,
  allTypes?: PayanarssTypeSummary[]
): string {
  const parts: string[] = [];

  // Attach the full type tree so Claude sees everything already defined
  if (allTypes && allTypes.length > 0) {
    parts.push(
      `EXISTING PAYANARSSTYPE TREE (${allTypes.length} nodes):`,
      JSON.stringify(allTypes, null, 2),
      ""
    );
  }

  if (parentName && parentTypeName) {
    parts.push(
      `CURRENT PARENT: "${parentName}" (type: ${parentTypeName})`,
      "",
      `GENERATION RULES based on parent type:`,
      `- BusinessUseCase → generate TableType nodes with ValueType children. Do NOT add another BusinessUseCase.`,
      `- TableType / ChildTableType → generate ValueType children (columns/fields) only.`,
      `- GroupType → generate BusinessUseCase or TableType nodes.`,
      `- Avoid duplicating any Name already present in the tree above.`,
      ""
    );
  } else if (parentName) {
    parts.push(`Parent context: "${parentName}"`, "");
  }

  parts.push(`USER REQUEST: ${prompt}`);
  return parts.join("\n");
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function generateTypes(
  prompt: string,
  parentName?: string,
  parentTypeName?: string,
  allTypes?: PayanarssTypeSummary[]
): Promise<GeneratedField[]> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Anthropic API key not configured. Add VITE_ANTHROPIC_API_KEY to your .env file."
    );
  }

  let response: Response;
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: buildSystemPrompt(),
        messages: [
          {
            role: "user",
            content: buildUserPrompt(prompt, parentName, parentTypeName, allTypes),
          },
        ],
      }),
    });
  } catch (networkError) {
    throw new Error(
      "Network error — could not reach Anthropic API. Check your internet connection."
    );
  }

  if (!response.ok) {
    let detail = "";
    try {
      const errBody = await response.json();
      detail = errBody?.error?.message || JSON.stringify(errBody);
    } catch {
      detail = `HTTP ${response.status}`;
    }
    throw new Error(`Anthropic API error: ${detail}`);
  }

  let data: { content?: { type: string; text: string }[] };
  try {
    data = await response.json();
  } catch {
    throw new Error("Invalid JSON response from Anthropic API.");
  }

  const textBlock = data.content?.find((b) => b.type === "text");
  if (!textBlock?.text) {
    throw new Error("Empty response from Claude.");
  }

  // Strip any accidental markdown fences
  const raw = textBlock.text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  let parsed: GenerateTypesResponse;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("Claude returned non-JSON:", raw);
    throw new Error("Claude returned an unexpected response format. Please try again.");
  }

  if (!parsed.fields || !Array.isArray(parsed.fields)) {
    throw new Error("Claude response missing 'fields' array.");
  }

  // Sanitise: ensure valid types; fall back to ValueType if unknown
  const validSet = new Set<string>(VALID_TYPES);
  const tablesNeedingColumns: string[] = [];

  const sanitised = parsed.fields.map((f) => {
    const sanitisedField: GeneratedField = {
      name: f.name ?? "UnnamedField",
      type: validSet.has(f.type) ? f.type : "ValueType",
      description: f.description ?? "",
      children: f.children?.map((c) => ({
        name: c.name ?? "UnnamedField",
        type: validSet.has(c.type) ? c.type : "ValueType",
        description: c.description ?? "",
      })),
    };

    // Track tables that came back without columns so we can fill them
    const needsChildren = ["TableType", "ChildTableType", "LookupType"].includes(sanitisedField.type);
    if (needsChildren && (!sanitisedField.children || sanitisedField.children.length === 0)) {
      tablesNeedingColumns.push(sanitisedField.name);
    }

    return sanitisedField;
  });

  // Auto-fill columns for any table that came back empty
  if (tablesNeedingColumns.length > 0) {
    const fillPromises = tablesNeedingColumns.map(async (tableName) => {
      const fillPrompt = `Generate 6–10 columns (ValueType fields) for a table called "${tableName}". Return ONLY a JSON object: { "fields": [ { "name": "...", "type": "ValueType", "description": "..." } ] }`;
      const fillResponse = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 800,
          messages: [{ role: "user", content: fillPrompt }],
        }),
      });
      if (!fillResponse.ok) return { tableName, columns: [] };
      const fillData = await fillResponse.json();
      const fillText = fillData.content?.find((b: { type: string }) => b.type === "text")?.text ?? "";
      const cleanFill = fillText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
      try {
        const fillParsed = JSON.parse(cleanFill);
        return { tableName, columns: fillParsed.fields ?? [] };
      } catch {
        return { tableName, columns: [] };
      }
    });

    const filled = await Promise.all(fillPromises);
    filled.forEach(({ tableName, columns }) => {
      const target = sanitised.find((f) => f.name === tableName);
      if (target && columns.length > 0) {
        target.children = columns.map((c: GeneratedField) => ({
          name: c.name ?? "UnnamedField",
          type: "ValueType",
          description: c.description ?? "",
        }));
      }
    });
  }

  return sanitised;
}
