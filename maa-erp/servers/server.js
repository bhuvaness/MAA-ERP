/**
 * server.js — MAA ERP Express Backend (POC)
 * ==========================================
 * Loads VanakkamPayanarssTypes.json at startup, extracts a navigable
 * catalog of Modules / Use Cases / Solutions / Groups, and sends it
 * to Claude API so Claude can ONLY match from real data.
 *
 * Claude NEVER invents IDs — it picks from the catalog we send.
 *
 * Usage:
 *   CLAUDE_API_KEY=sk-ant-... node server.js
 *
 * Endpoints:
 *   POST /api/claude-match  { prompt: "gym business" }
 *     → { matchedIds: [...], summary: "..." }
 */

import 'dotenv/config';
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3001;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

if (!CLAUDE_API_KEY) {
  console.error("❌  Missing CLAUDE_API_KEY environment variable.");
  console.error("   Run: CLAUDE_API_KEY=sk-ant-... node server.js");
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════
// 1. LOAD & INDEX VanakkamPayanarssTypes.json AT STARTUP
// ═══════════════════════════════════════════════════════════════

const JSON_PATH = path.join(__dirname, "public", "data", "VanakkamPayanarssTypes.json");

let allNodes = [];
let catalogText = "";    // Compact text sent to Claude
let idMap = new Map();   // Quick lookup by Id

// PayanarssTypeIds we send to Claude (navigable levels only)
const CATALOG_TYPE_IDS = new Set([
  "10000000000000000000000000000011111",   // BusinessSolutions
  "10000000000000000000000000000001111",   // BusinessModules
  "10000000000000000000000000000000111",   // BusinessUseCase
  "100000000000000000000000000000004",     // GroupType
]);

function loadCatalog() {
  console.log(`📦 Loading ${JSON_PATH} ...`);
  const raw = fs.readFileSync(JSON_PATH, "utf-8");
  allNodes = JSON.parse(raw);
  console.log(`   Total nodes: ${allNodes.length}`);

  // Build lookup
  for (const n of allNodes) idMap.set(n.Id, n);

  // Extract navigable nodes → compact "Id | Name | ParentName" lines
  const catalogLines = [];
  for (const n of allNodes) {
    if (!CATALOG_TYPE_IDS.has(n.PayanarssTypeId)) continue;

    const parent = idMap.get(n.ParentId);
    const parentName = parent && parent.Id !== n.Id ? parent.Name : "";
    catalogLines.push(`${n.Id} | ${n.Name} | ${parentName}`);
  }

  catalogText = catalogLines.join("\n");
  console.log(`   Catalog nodes: ${catalogLines.length} (${(catalogText.length / 1024).toFixed(1)} KB)`);
  console.log(`✅ Catalog ready.\n`);
}

try {
  loadCatalog();
} catch (err) {
  console.error(`❌  Failed to load JSON: ${err.message}`);
  console.error(`   Expected at: ${JSON_PATH}`);
  console.error(`   Make sure VanakkamPayanarssTypes.json is in public/data/`);
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════
// 2. CLAUDE MATCH ENDPOINT
// ═══════════════════════════════════════════════════════════════

app.post("/api/claude-match", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Missing 'prompt' in request body" });
  }

  console.log(`\n🔍 Claude match request: "${prompt}"`);

  try {
    const systemPrompt = `You are the MAA ERP module matcher. You will receive:
1. A USER REQUEST describing a business type or need.
2. A CATALOG of PayanarssType nodes in the format: Id | Name | ParentName

The catalog is a HIERARCHY. Each node has a ParentName showing where it sits in the tree.
Example hierarchy: "Personal Services" → "Gym Business DB Schema" → "Register Business" → "Choose Business Name"

YOUR TASK:
- Read the CATALOG carefully and find nodes that SPECIFICALLY match the user's business.
- PRIORITIZE SPECIFIC MATCHES over broad sector categories:
  • If user says "gym business", match "Gym Business DB Schema" and ALL its descendants (children, grandchildren, etc.) — NOT the broad "Sports & Recreation" sector.
  • If user says "restaurant", match "Restaurant Management" and its descendants — NOT the broad "Food & Beverage" sector.
  • Look for nodes whose Name contains the business keyword (e.g., "Gym", "Restaurant", "Hotel").
  • Then include ALL nodes whose ParentName chain traces back to that specific match.
- RETURN ALL DESCENDANTS: When you find the specific business root (e.g., "Gym Business DB Schema"), return its Id AND the Ids of ALL nodes that are children/grandchildren of it in the catalog.
- Also include the PARENT SECTOR of the matched business (e.g., "Personal Services" for "Gym Business DB Schema").
- NEVER invent, fabricate, or hallucinate any Id. Every Id you return MUST exist exactly as shown in the catalog.
- Return as many matching Ids as needed — for a full business like "gym", this could be 100-500 Ids.

RESPONSE FORMAT — respond with ONLY this JSON, no markdown fences, no explanation:
{
  "matchedIds": ["id1", "id2", ...],
  "summary": "One sentence describing what was matched"
}`;

    const userMessage = `USER REQUEST: ${prompt}

CATALOG (Id | Name | ParentName):
${catalogText}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 16000,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`❌ Claude API ${response.status}: ${errBody}`);
      return res.status(502).json({ error: `Claude API error: ${response.status}` });
    }

    const data = await response.json();

    // Extract text from response
    const text = data.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    // Parse JSON response
    const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("❌ Failed to parse Claude response:", text.substring(0, 500));
      return res.status(502).json({ error: "Invalid response from Claude", raw: text.substring(0, 500) });
    }

    const matchedIds = parsed.matchedIds || [];
    const summary = parsed.summary || "";

    // VALIDATE: Only allow IDs that actually exist in our data
    const validIds = matchedIds.filter((id) => idMap.has(id));
    const rejected = matchedIds.length - validIds.length;

    if (rejected > 0) {
      console.warn(`⚠️  Rejected ${rejected} hallucinated IDs out of ${matchedIds.length}`);
    }

    console.log(`✅ Matched ${validIds.length} valid IDs (rejected ${rejected} invalid)`);
    console.log(`   Summary: ${summary}`);

    res.json({
      matchedIds: validIds,
      summary,
      stats: {
        requested: matchedIds.length,
        valid: validIds.length,
        rejected,
      },
    });
  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 3. HEALTH CHECK
// ═══════════════════════════════════════════════════════════════

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    catalogNodes: allNodes.length,
    catalogSize: `${(catalogText.length / 1024).toFixed(1)} KB`,
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. START
// ═══════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log(`🚀 MAA ERP Express server running on http://localhost:${PORT}`);
  console.log(`   POST /api/claude-match   — AI module matching`);
  console.log(`   GET  /api/health         — Health check\n`);
});
