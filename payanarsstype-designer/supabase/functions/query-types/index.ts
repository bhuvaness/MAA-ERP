import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const DEFAULT_NAMESPACE = 'payanarss-types';

// Sector detection: maps keywords in user query to sector names in metadata
const SECTOR_KEYWORDS: Record<string, string[]> = {
  'Common Modules': ['hr', 'human resources', 'payroll', 'salary', 'accounting', 'finance', 'employee', 'company setup', 'user management'],
  'Manufacturing': ['manufacturing', 'factory', 'production', 'assembly', 'textile', 'chemical', 'pharmaceutical'],
  'Construction & Real Estate': ['construction', 'real estate', 'building', 'contractor', 'civil', 'infrastructure'],
  'Retail & E-Commerce': ['retail', 'shop', 'store', 'e-commerce', 'ecommerce', 'grocery', 'supermarket', 'fashion', 'electronics'],
  'Food & Beverage': ['restaurant', 'cafe', 'coffee', 'catering', 'food', 'beverage', 'kitchen', 'bakery', 'bar', 'fast food'],
  'Hospitality & Travel': ['hotel', 'resort', 'travel', 'tourism', 'hospitality', 'lodge', 'serviced apartment', 'booking'],
  'Healthcare': ['hospital', 'clinic', 'pharmacy', 'medical', 'healthcare', 'dental', 'lab', 'diagnostic', 'doctor', 'patient'],
  'Education': ['school', 'university', 'college', 'training', 'education', 'student', 'teacher', 'course', 'e-learning'],
  'Transportation & Logistics': ['transport', 'logistics', 'freight', 'cargo', 'delivery', 'warehouse', 'fleet', 'shipping'],
  'Financial Services': ['banking', 'insurance', 'investment', 'fintech', 'loan', 'credit', 'microfinance'],
  'Professional Services': ['law firm', 'legal', 'consulting', 'architecture', 'engineering', 'audit', 'recruitment'],
  'Technology & IT': ['software', 'it services', 'data center', 'cloud', 'saas', 'cybersecurity', 'ai company'],
  'Personal Services': ['salon', 'spa', 'gym', 'fitness', 'laundry', 'cleaning', 'wedding', 'photography', 'pet', 'beauty'],
  'Agriculture & Farming': ['farm', 'agriculture', 'crop', 'livestock', 'dairy', 'greenhouse', 'aquaculture'],
  'Energy & Utilities': ['oil', 'gas', 'solar', 'renewable', 'energy', 'water', 'waste', 'power', 'utility'],
  'Media & Entertainment': ['film', 'tv', 'gaming', 'esports', 'publishing', 'news', 'music', 'event', 'media'],
  'Government & Public': ['government', 'municipal', 'public safety', 'public transport', 'defense'],
  'Sports & Recreation': ['sports', 'club', 'academy', 'recreation', 'leisure', 'swimming pool', 'stadium'],
  'Religious & Community': ['mosque', 'church', 'temple', 'community', 'congregation', 'charity'],
};

interface QueryResult {
  id: string;
  score: number;
  metadata: {
    name: string;
    description: string;
    level: string;
    sector: string;
    module: string;
    submodule: string;
    usecase: string;
    path: string;
    is_common: boolean;
    parent_name: string;
    child_count: number;
    column_names: string;
    column_types: string;
    column_count: number;
    table_count: number;
    embedding_text: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PINECONE_API_KEY = Deno.env.get('PINECONE_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!PINECONE_API_KEY) throw new Error('PINECONE_API_KEY is not configured');

    const { query, indexHost, topK = 15, sectorFilter, levelFilter } = await req.json();
    if (!query) throw new Error('query is required');
    if (!indexHost) throw new Error('indexHost is required');

    console.log(`Query: "${query}"`);

    // Step 1: Detect sector from user query
    const detectedSector = sectorFilter || detectSector(query);
    console.log(`Detected sector: ${detectedSector}`);

    // Step 2: Build Pinecone filter
    const filter: Record<string, unknown> = {};
    if (detectedSector && detectedSector !== 'General') {
      filter.sector = { '$in': [detectedSector, 'Common Modules'] };
    }
    if (levelFilter) {
      filter.level = levelFilter;
    }

    // Step 3: Query Pinecone — try integrated inference first
    let results: QueryResult[] = [];
    let searchMethod = 'integrated';

    // Try integrated inference search (text-based)
    try {
      const resp = await fetch(`https://${indexHost}/records/search`, {
        method: 'POST',
        headers: { 'Api-Key': PINECONE_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: { text: query },
          namespace: DEFAULT_NAMESPACE,
          top_k: topK,
          ...(Object.keys(filter).length > 0 ? { filter } : {}),
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        results = (data.result?.hits || []).map((hit: { _id: string; _score: number; fields: Record<string, unknown> }) => ({
          id: hit._id,
          score: hit._score,
          metadata: hit.fields,
        }));
      } else {
        console.warn(`Integrated search failed (${resp.status}), falling back to vector`);
        searchMethod = 'fallback';
      }
    } catch (e) {
      console.warn(`Integrated search error: ${e}`);
      searchMethod = 'fallback';
    }

    // Fallback: generate local embedding and do vector query
    if (searchMethod === 'fallback') {
      const queryVector = generateLocalEmbedding(query);

      const queryBody: Record<string, unknown> = {
        vector: queryVector,
        topK,
        includeMetadata: true,
        namespace: DEFAULT_NAMESPACE,
      };
      if (Object.keys(filter).length > 0) queryBody.filter = filter;

      const resp = await fetch(`https://${indexHost}/query`, {
        method: 'POST',
        headers: { 'Api-Key': PINECONE_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(queryBody),
      });

      if (!resp.ok) throw new Error(`Pinecone query failed: ${await resp.text()}`);

      const data = await resp.json();
      results = (data.matches || []).map((m: { id: string; score: number; metadata: Record<string, unknown> }) => ({
        id: m.id,
        score: m.score,
        metadata: m.metadata,
      }));
    }

    console.log(`Found ${results.length} results via ${searchMethod}`);

    // If sector filter gave few results, broaden search
    if (results.length < 5 && detectedSector !== 'General' && Object.keys(filter).length > 0) {
      console.log('Few results with filter, broadening search...');
      let broadResults: QueryResult[] = [];

      if (searchMethod === 'integrated') {
        try {
          const resp = await fetch(`https://${indexHost}/records/search`, {
            method: 'POST',
            headers: { 'Api-Key': PINECONE_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: { text: query },
              namespace: DEFAULT_NAMESPACE,
              top_k: topK,
            }),
          });
          if (resp.ok) {
            const data = await resp.json();
            broadResults = (data.result?.hits || []).map((hit: { _id: string; _score: number; fields: Record<string, unknown> }) => ({
              id: hit._id,
              score: hit._score * 0.8, // Penalize non-sector matches
              metadata: hit.fields,
            }));
          }
        } catch { /* ignore */ }
      } else {
        const queryVector = generateLocalEmbedding(query);
        const resp = await fetch(`https://${indexHost}/query`, {
          method: 'POST',
          headers: { 'Api-Key': PINECONE_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ vector: queryVector, topK, includeMetadata: true, namespace: DEFAULT_NAMESPACE }),
        });
        if (resp.ok) {
          const data = await resp.json();
          broadResults = (data.matches || []).map((m: { id: string; score: number; metadata: Record<string, unknown> }) => ({
            id: m.id, score: m.score * 0.8, metadata: m.metadata,
          }));
        }
      }

      // Merge unique
      const existingIds = new Set(results.map(r => r.id));
      for (const r of broadResults) {
        if (!existingIds.has(r.id)) results.push(r);
      }
      results.sort((a, b) => b.score - a.score);
      results = results.slice(0, topK);
    }

    // Step 4: Generate AI summary
    const aiSummary = LOVABLE_API_KEY
      ? await generateAISummary(query, detectedSector, results, LOVABLE_API_KEY)
      : buildBasicSummary(results);

    return new Response(
      JSON.stringify({
        success: true,
        query,
        detectedSector,
        searchMethod,
        results,
        aiSummary,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Query error:', error);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ═══════════════════════════════════════
// SECTOR DETECTION
// ═══════════════════════════════════════

function detectSector(query: string): string {
  const lower = query.toLowerCase();
  let best = 'General';
  let bestScore = 0;

  for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        score += kw.split(' ').length * 2;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = sector;
    }
  }
  return best;
}

// ═══════════════════════════════════════
// AI SUMMARY
// ═══════════════════════════════════════

async function generateAISummary(
  query: string,
  sector: string,
  results: QueryResult[],
  apiKey: string
): Promise<string> {
  if (results.length === 0) {
    return 'No matching types found. Try describing your business needs differently.';
  }

  try {
    // Group results by level
    const modules = results.filter(r => r.metadata.level === 'module');
    const submodules = results.filter(r => r.metadata.level === 'submodule');
    const usecases = results.filter(r => r.metadata.level === 'usecase');
    const tables = results.filter(r => r.metadata.level === 'table');
    const commonResults = results.filter(r => r.metadata.is_common);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You are Viki, an ERP solution architect for MAA ERP. Recommend modules and tables for the user's business. Format:

**Recommended Modules:**
[List with brief explanation]

**Core Tables:**
[Key tables with column highlights]

**Common Modules (always included):**
[HR, Finance, etc.]

**Next Steps:**
[What to configure first]

Keep under 300 words. Be specific to ${sector}.`,
          },
          {
            role: 'user',
            content: `Business requirement: "${query}"
Sector: ${sector}

Modules found (${modules.length}):
${modules.slice(0, 5).map(r => `- ${r.metadata.name} [${r.metadata.sector}] (${r.metadata.table_count} tables, score: ${(r.score * 100).toFixed(0)}%)`).join('\n')}

Sub-modules (${submodules.length}):
${submodules.slice(0, 5).map(r => `- ${r.metadata.name} under ${r.metadata.module}`).join('\n')}

Use Cases (${usecases.length}):
${usecases.slice(0, 5).map(r => `- ${r.metadata.name}`).join('\n')}

Tables (${tables.length}):
${tables.slice(0, 5).map(r => `- ${r.metadata.name} (${r.metadata.column_count} cols: ${r.metadata.column_names?.split(',').slice(0, 5).join(', ')})`).join('\n')}

Common Modules:
${commonResults.slice(0, 3).map(r => `- ${r.metadata.name}`).join('\n')}`,
          },
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) return buildBasicSummary(results);

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || buildBasicSummary(results);
  } catch {
    return buildBasicSummary(results);
  }
}

function buildBasicSummary(results: QueryResult[]): string {
  const modules = results.filter(r => r.metadata.level === 'module');
  const tables = results.filter(r => r.metadata.level === 'table');
  return `Found ${results.length} matching items. Modules: ${modules.map(r => r.metadata.name).join(', ') || 'none'}. Tables: ${tables.map(r => r.metadata.name).join(', ') || 'none'}.`;
}

// ═══════════════════════════════════════
// FALLBACK: Local Embedding
// MUST match embed-types exactly
// ═══════════════════════════════════════

function generateLocalEmbedding(text: string, dimensions = 1024): number[] {
  const embedding = new Array(dimensions).fill(0);
  const words = text.toLowerCase().split(/[\s,.\-_:;()]+/).filter(w => w.length > 1);

  const freq: Record<string, number> = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;

  for (const [word, count] of Object.entries(freq)) {
    let hash = 0;
    for (let j = 0; j < word.length; j++) {
      hash = ((hash << 5) - hash + word.charCodeAt(j)) | 0;
    }
    const weight = Math.log(1 + count);
    embedding[Math.abs(hash) % dimensions] += 3 * weight;
    embedding[Math.abs(hash * 31) % dimensions] += 2 * weight;
    embedding[Math.abs(hash * 97) % dimensions] += 1 * weight;
  }

  for (let i = 0; i < words.length - 1; i++) {
    const bg = words[i] + '_' + words[i + 1];
    let hash = 0;
    for (let j = 0; j < bg.length; j++) hash = ((hash << 5) - hash + bg.charCodeAt(j)) | 0;
    embedding[Math.abs(hash) % dimensions] += 4;
  }

  const mag = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
  if (mag > 0) for (let i = 0; i < dimensions; i++) embedding[i] /= mag;
  return embedding;
}
