# MAA ERP — Embedding Pipeline: What to Change

## Your Current State (Analysis of Your Codebase)

### What You Already Have (Working)

**Project structure is solid.** Your PayanarssType Designer is well-organized with clear separation:

- `src/services/pineconeService.ts` — Client-side Pinecone integration
- `src/components/agent/EmbedTypesButton.tsx` — Batch embed UI with progress tracking and retry
- `src/components/agent/AgentQueryInterface.tsx` — NLP query UI
- `supabase/functions/embed-types/index.ts` — Server-side embedding edge function
- `supabase/functions/query-types/index.ts` — Server-side query edge function
- Pinecone index: `payanarss-type-y3f7eec.svc.aped-4627-b74a.pinecone.io`

**Data is rich.** 12,609 PayanarssType nodes covering 19 sectors, with Common Modules fully built out (tables with full column definitions including data types and descriptions).

**Hierarchy is clear:**

```
MAA ERP (root)
├── Common Modules (10 modules — fully detailed)
│   ├── Company Setup → Sub-modules → Use Cases → Tables → Columns
│   ├── HR & Payroll → Employee Mgmt, Attendance, Leave, Payroll, Recruitment
│   ├── Finance & Accounting
│   └── ... 7 more
├── Personal Services
│   └── Gym & Fitness Center (4 modules — fully detailed)
│       ├── Membership Management → Registration, Plans
│       ├── Class & Training → Group Classes, Personal Training
│       ├── Access & Check-In → Check-In System, Locker Assignment
│       └── Sales & Retail → Pro Shop, Inventory
├── Manufacturing (14 module names — empty shells)
├── Healthcare (13 module names — empty shells)
└── ... 15 more sectors (module names only, no children)
```

---

## 3 Critical Problems to Fix

### Problem 1: DIY Embedding Instead of Real Model

**This is the biggest issue.** Your `generateEmbedding()` function in both edge functions uses a custom hash-based approach:

```typescript
// Your current code — NOT a real embedding
function generateEmbedding(text: string, dimensions: number = 1024): number[] {
  const embedding = new Array(dimensions).fill(0);
  // ... hashing words into array positions
  embedding[idx1] += 3 * weight;
  // ... normalize
}
```

This is essentially a bag-of-words hash — it has **zero semantic understanding**. "Employee Management" and "Staff Administration" would produce completely different vectors, even though they mean the same thing.

**Fix:** Use Pinecone's integrated inference model or call an external embedding API. Pinecone now supports server-side inference, meaning you send text and Pinecone embeds it using `multilingual-e5-large` or `llama-text-embed-v2`.

### Problem 2: Domain Keywords Only Cover 9 of 19 Sectors

Your `DOMAIN_KEYWORDS` map has:

```
✅ HotelManagement, TenancyManagement, Procurement,
   FacilitiesManagement, ProjectManagement, HRPayroll,
   FinanceAccounting, InventoryManagement, ITAssetManagement

❌ Missing: Manufacturing, Construction, Retail, Food & Beverage,
   Healthcare, Education, Transportation, Financial Services,
   Professional Services, Technology, Personal Services,
   Agriculture, Energy, Media, Government, Sports, Religious
```

**Fix:** Either expand to all 19 sectors, or (better) stop relying on keyword matching and let the real embedding model handle semantics.

### Problem 3: No Hierarchy-Aware Metadata

Your current metadata only stores: `name, parentId, payanarssTypeId, description, hasAttributes, domain, purpose, module, keywords, parentName, childCount`

It's missing the most important metadata for the MAA ERP use case:

- **`sector`** — Which of the 19 sectors does this belong to? (for filtering)
- **`level`** — Is this a Sector, Module, Sub-module, UseCase, Table, or Column?
- **`path`** — Full breadcrumb: "Personal Services > Gym > Membership > Member Registration"
- **`column_names`** — List of columns (for tables only)
- **`column_types`** — Data types of columns (STRING, LOOKUP, DATE, etc.)
- **`is_common`** — Is this under Common Modules? (always included for every business)

---

## Exactly What to Change (File by File)

### Change 1: `supabase/functions/embed-types/index.ts`

**Replace the DIY `generateEmbedding()` with Pinecone's inference API.**

Replace your current upsert call with Pinecone's integrated inference endpoint. This means you send raw text, and Pinecone embeds it server-side using `multilingual-e5-large`:

```typescript
// BEFORE: You generate embedding client-side (bad)
const embeddings = enrichedData.map(d => generateEmbedding(d.embeddingText));
const vectors = batch.map((type, idx) => ({
  id: type.Id,
  values: embeddings[idx],
  metadata: enrichedData[idx].metadata,
}));
await fetch(`https://${indexHost}/vectors/upsert`, { body: JSON.stringify({ vectors }) });

// AFTER: Let Pinecone embed using real model
const records = batch.map((type, idx) => ({
  _id: type.Id,
  text: enrichedData[idx].embeddingText,   // Raw text — Pinecone embeds it
  metadata: enrichedData[idx].metadata,
}));
await fetch(`https://${indexHost}/records/upsert`, {
  method: 'POST',
  headers: { 'Api-Key': PINECONE_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ records, namespace: 'payanarss-types' }),
});
```

**If Pinecone integrated inference isn't available on your plan**, call a dedicated embedding API instead. You can use the Anthropic-compatible endpoint you already have (`ai.gateway.lovable.dev`), or call OpenAI/Cohere's embedding endpoint, or use Hugging Face's inference API for `multilingual-e5-large`.

### Change 2: Add Hierarchy-Aware Metadata Extraction

**In `enrichTypeForEmbedding()`, walk up the tree to extract full hierarchy:**

```typescript
function getAncestors(type: PayanarssType, allTypes: PayanarssType[]): PayanarssType[] {
  const ancestors: PayanarssType[] = [];
  let current = type;
  while (current.ParentId && current.ParentId !== current.Id) {
    const parent = allTypes.find(t => t.Id === current.ParentId);
    if (!parent || parent.Id === current.Id) break;
    ancestors.unshift(parent);
    current = parent;
  }
  return ancestors;
}

function getLevel(ancestors: PayanarssType[]): string {
  // ancestors[0] = MAA ERP (root)
  // ancestors[1] = Sector (Personal Services)
  // ancestors[2] = Module (Gym & Fitness Center)
  // etc.
  const depth = ancestors.length;
  if (depth <= 1) return 'root';
  if (depth === 2) return 'sector';
  if (depth === 3) return 'module';
  if (depth === 4) return 'submodule';
  if (depth === 5) return 'usecase';
  if (depth === 6) return 'table';
  return 'column';
}
```

**Update metadata to include:**

```typescript
const ancestors = getAncestors(type, allTypes);
const level = getLevel(ancestors);

const metadata = {
  name: type.Name,
  description: type.Description || '',
  level: level,                                    // NEW
  sector: ancestors[1]?.Name || '',                // NEW: "Personal Services"
  module: ancestors[2]?.Name || '',                // "Gym & Fitness Center"
  submodule: ancestors[3]?.Name || '',             // "Membership Management"
  usecase: ancestors[4]?.Name || '',               // "Member Registration"
  path: ancestors.map(a => a.Name).join(' > '),    // NEW: full breadcrumb
  is_common: ancestors[1]?.Name === 'Common Modules',  // NEW
  parent_name: parent?.Name || '',
  child_count: children.length,
  
  // For table-level nodes: include column info
  column_names: level === 'table' 
    ? children.map(c => c.Name).join(',') : '',     // NEW
  column_types: level === 'table'
    ? children.map(c => {
        const desc = c.Description || '';
        if (desc.includes('LOOKUP')) return 'LOOKUP';
        if (desc.includes('DATE')) return 'DATE';
        if (desc.includes('BOOLEAN')) return 'BOOLEAN';
        if (desc.includes('DECIMAL') || desc.includes('INTEGER')) return 'NUMBER';
        return 'STRING';
      }).join(',') : '',                             // NEW
};
```

### Change 3: Fix Embedding Text (Less Noise, More Signal)

**Your current embed text has too much noise** — repeating domain keywords 3 times, adding generic keywords. The real embedding model doesn't need this.

```typescript
// BEFORE (your current code — too noisy):
`Domain: ${domain}. ${domain} domain. ${domain} system.`
`Domain keywords: ${domainKeywordList.slice(0, 15).join(', ')}`
`${domain}: ${domainKeywordList.slice(0, 10).join(' ')}`

// AFTER (clean, meaningful text for real embedding model):
function buildEmbedText(type, ancestors, children, level) {
  const sector = ancestors[1]?.Name || '';
  const module = ancestors[2]?.Name || '';
  
  switch (level) {
    case 'sector':
      return `${type.Name} industry sector with modules for ${
        children.map(c => c.Name).join(', ')
      }`;
    
    case 'module':
      return `${type.Name} module in ${sector} sector. ${
        type.Description || ''
      }. Sub-modules: ${children.map(c => c.Name).join(', ')}`;
    
    case 'submodule':
      return `${type.Name} for ${module} in ${sector}. ${
        type.Description || ''
      }. Use cases: ${children.map(c => c.Name).join(', ')}`;
    
    case 'usecase':
      return `${type.Name} business process for ${module}. ${
        type.Description || ''
      }. Tables: ${children.map(c => c.Name).join(', ')}`;
    
    case 'table':
      const columnNames = children.map(c => c.Name).join(', ');
      return `${type.Name} database table for ${module} in ${sector}. ${
        type.Description || ''
      }. Columns: ${columnNames}`;
    
    default:
      return `${type.Name} ${type.Description || ''}`;
  }
}
```

### Change 4: `supabase/functions/query-types/index.ts`

**Same fix — replace DIY embedding with real model for query vector:**

```typescript
// BEFORE:
const queryVector = generateEmbedding(expandedQuery);
await fetch(`https://${indexHost}/query`, {
  body: JSON.stringify({ vector: queryVector, topK, ... })
});

// AFTER: Use Pinecone's search endpoint with text query
await fetch(`https://${indexHost}/records/search`, {
  method: 'POST',
  headers: { 'Api-Key': PINECONE_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: { text: expandedQuery },
    namespace: 'payanarss-types',
    top_k: topK,
    filter: filter,
  })
});
```

**Also, simplify domain detection.** With a real embedding model, you don't need heavy keyword weighting. The model understands "gym membership" is related to "fitness center" semantically. You still want metadata filtering for precision, but the query expansion can be much simpler.

### Change 5: Selective Embedding (Don't Embed Everything)

**You have 12,609 nodes but should only embed ~2,000.** Columns don't need their own vectors — they should be metadata on their parent table.

```typescript
const EMBEDDABLE_LEVELS = ['sector', 'module', 'submodule', 'usecase', 'table'];

// In your embedding loop:
for (const type of allTypes) {
  const ancestors = getAncestors(type, allTypes);
  const level = getLevel(ancestors);
  
  if (!EMBEDDABLE_LEVELS.includes(level)) continue;  // Skip columns and root
  
  // ... embed this node
}
```

This reduces your Pinecone usage from 12,609 vectors to approximately 2,000, saving cost and improving search accuracy (no noise from individual column vectors).

### Change 6: `src/services/pineconeService.ts` — Add Metadata Types

Update the `QueryResult` interface to include new metadata fields:

```typescript
export interface QueryResult {
  id: string;
  score: number;
  metadata: {
    name: string;
    description: string;
    level: string;          // NEW: sector|module|submodule|usecase|table
    sector: string;         // NEW: "Personal Services"
    module: string;         // "Gym & Fitness Center"
    submodule: string;      // NEW: "Membership Management"
    usecase: string;        // NEW: "Member Registration"
    path: string;           // NEW: full breadcrumb
    is_common: boolean;     // NEW
    parent_name: string;
    child_count: number;
    column_names: string;   // NEW: comma-separated
    column_types: string;   // NEW: comma-separated
  };
}
```

### Change 7: Create Pinecone Index with Integrated Inference

**You may need to recreate your Pinecone index** to support integrated inference:

```
Index name: payanarss-type (or new name)
Model: multilingual-e5-large (for English + Arabic support)
Metric: cosine
Cloud: AWS / us-east-1
Namespace: payanarss-types
```

Check Pinecone dashboard → does your current index support integrated inference? If not, create a new index with it enabled.

---

## New Feature: Export API for MAA ERP

### Change 8: Add `supabase/functions/get-business-config/index.ts`

This is the **bridge** endpoint that MAA ERP calls after the user confirms their module selection:

```typescript
serve(async (req) => {
  const { selectedModuleIds, businessType } = await req.json();
  
  // 1. Load full PayanarssType JSON
  const allTypes = await loadAllTypes();
  
  // 2. For each selected module, extract full tree (tables + columns + rules)
  const config = selectedModuleIds.map(moduleId => {
    const module = allTypes.find(t => t.Id === moduleId);
    return {
      moduleId: module.Id,
      moduleName: module.Name,
      tables: extractTables(module.Id, allTypes),
      // Each table includes: name, columns[], column_types[], rules[]
    };
  });
  
  // 3. Always include Common Modules
  const commonModules = getCommonModules(allTypes);
  
  return Response.json({
    businessType,
    commonModules,
    selectedModules: config,
    // MAA ERP uses this to: create DB tables, register Viki tools, build UI
  });
});
```

---

## Execution Order

| Step | What | Time | Priority |
|------|------|------|----------|
| 1 | Create new Pinecone index with integrated inference | 15 min | Must do first |
| 2 | Update `embed-types/index.ts` — real embeddings + hierarchy metadata | 2 hours | Critical |
| 3 | Update `query-types/index.ts` — use Pinecone search, simplify expansion | 1.5 hours | Critical |
| 4 | Update `pineconeService.ts` — new metadata types | 30 min | Easy |
| 5 | Re-run embedding (press "Embed All Types") | ~10 min | After steps 1-3 |
| 6 | Test queries in AgentQueryInterface | 30 min | Validate |
| 7 | Create `get-business-config` edge function | 2 hours | For MAA ERP bridge |
| 8 | Fill empty sector modules (Manufacturing, Healthcare, etc.) | Ongoing | Content work |

---

## Claude Code Prompt to Execute

Once you're ready, give Claude Code this prompt in the **payanarsstype-designer** project:

```
Read this document at docs/embedding-changes.md.

Make the following changes:

1. In supabase/functions/embed-types/index.ts:
   - Remove the DIY generateEmbedding() function
   - Add getAncestors() and getLevel() helper functions
   - Update enrichTypeForEmbedding() to include hierarchy metadata 
     (sector, level, path, is_common, column_names, column_types)
   - Update buildEmbedText to use clean, level-specific text
   - Only embed nodes at levels: sector, module, submodule, usecase, table
   - Use Pinecone's integrated inference for embedding (send text, not vectors)
   
2. In supabase/functions/query-types/index.ts:
   - Remove the DIY generateEmbedding() function
   - Use Pinecone's search endpoint with text query instead of vector
   - Simplify domain detection (use metadata filter on sector field)
   - Keep AI summary generation
   
3. In src/services/pineconeService.ts:
   - Update QueryResult interface with new metadata fields
   
4. In src/components/agent/EmbedTypesButton.tsx:
   - No logic changes needed, it already works with the edge function

Do NOT change any UI components, routing, or other functionality.
```
