import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const EMBEDDING_DIMENSIONS = 1024;

// Domain detection keywords - MUST match embed-types exactly
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  HotelManagement: [
    'hotel', 'guest', 'room', 'reservation', 'booking', 'check-in', 'check-out', 
    'accommodation', 'hospitality', 'suite', 'housekeeping', 'concierge', 'stay',
    'lodge', 'inn', 'motel', 'resort', 'front desk', 'amenities', 'rate', 'occupancy',
    'room service', 'guest experience', 'hotel management', 'hospitality industry'
  ],
  TenancyManagement: [
    'tenancy', 'lease', 'tenant', 'rental', 'rent', 'property', 'landlord', 
    'occupancy', 'eviction', 'deposit', 'apartment', 'flat', 'real estate',
    'lease agreement', 'rental property', 'tenant management', 'property management'
  ],
  Procurement: [
    'procurement', 'purchase', 'vendor', 'supplier', 'order', 'rfq', 'quote', 
    'bidding', 'contract', 'invoice', 'sourcing', 'buying', 'purchase order',
    'vendor management', 'supply chain', 'procurement process'
  ],
  FacilitiesManagement: [
    'facilities', 'maintenance', 'repair', 'building', 'asset', 'work order', 
    'inspection', 'hvac', 'equipment', 'facility', 'building management'
  ],
  ProjectManagement: [
    'project', 'task', 'milestone', 'timeline', 'gantt', 'resource', 'schedule', 
    'deliverable', 'sprint', 'agile', 'project planning', 'project tracking'
  ],
  HRPayroll: [
    'employee', 'payroll', 'salary', 'leave', 'attendance', 'hr', 'recruitment', 
    'onboarding', 'benefits', 'human resources', 'staff', 'workforce'
  ],
  FinanceAccounting: [
    'finance', 'accounting', 'ledger', 'journal', 'invoice', 'payment', 'budget', 
    'expense', 'revenue', 'billing', 'financial', 'accounts'
  ],
  InventoryManagement: [
    'inventory', 'stock', 'warehouse', 'sku', 'product', 'item', 'quantity', 
    'reorder', 'storage', 'goods', 'inventory control'
  ],
  ITAssetManagement: [
    'it', 'asset', 'hardware', 'software', 'license', 'device', 'computer', 
    'network', 'technology', 'it asset'
  ],
};

interface QueryResult {
  id: string;
  score: number;
  metadata: {
    name: string;
    parentId: string;
    payanarssTypeId: string;
    description: string;
    hasAttributes: boolean;
    domain?: string;
    purpose?: string;
    module?: string;
    keywords?: string;
    parentName?: string;
    childCount?: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PINECONE_API_KEY = Deno.env.get('PINECONE_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!PINECONE_API_KEY) {
      throw new Error('PINECONE_API_KEY is not configured');
    }
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const { query, indexHost, topK = 15, domainFilter } = await req.json();

    if (!query) {
      throw new Error('query is required');
    }
    if (!indexHost) {
      throw new Error('indexHost is required');
    }

    console.log(`Processing query: "${query}"`);

    // Step 1: Detect domain from user query (STRICT matching)
    const detectedDomain = domainFilter || detectDomain(query);
    console.log(`Detected domain: ${detectedDomain}`);

    // Step 2: Build domain-weighted query text
    const expandedQuery = await buildDomainWeightedQuery(query, detectedDomain, LOVABLE_API_KEY);
    console.log(`Expanded query length: ${expandedQuery.length} chars`);

    // Step 3: Generate embedding (MUST match embed-types function exactly)
    const queryVector = generateEmbedding(expandedQuery);

    // Step 4: Query Pinecone WITH domain filter
    const filter: Record<string, unknown> = {};
    if (detectedDomain && detectedDomain !== 'General') {
      filter.domain = detectedDomain;
    }

    // First try with domain filter
    let results = await queryPinecone(indexHost, PINECONE_API_KEY, queryVector, topK, filter);
    console.log(`Domain-filtered results: ${results.length}`);

    // If we got very few results with filter, also try without filter and merge
    if (results.length < 5 && detectedDomain !== 'General') {
      console.log('Few results with domain filter, trying broader search...');
      const unfilteredResults = await queryPinecone(indexHost, PINECONE_API_KEY, queryVector, topK, {});
      
      // Merge: prioritize domain-matching results
      const existingIds = new Set(results.map(r => r.id));
      for (const r of unfilteredResults) {
        if (!existingIds.has(r.id)) {
          // Lower the score for non-domain matches
          results.push({ ...r, score: r.score * 0.7 });
        }
      }
      
      // Re-sort by score
      results.sort((a, b) => b.score - a.score);
      results = results.slice(0, topK);
    }

    // Step 5: Generate AI summary
    const aiSummary = await generateAISummary(query, detectedDomain, results, LOVABLE_API_KEY);

    return new Response(
      JSON.stringify({
        success: true,
        query,
        detectedDomain,
        results,
        aiSummary,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Query types error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Detect domain using STRICT keyword matching
 */
function detectDomain(query: string): string {
  const lowerQuery = query.toLowerCase();
  
  let bestDomain = 'General';
  let bestScore = 0;

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (lowerQuery.includes(kw)) {
        // Multi-word keywords get higher scores
        score += kw.split(' ').length * 2;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestDomain = domain;
    }
  }

  console.log(`Domain detection scores: ${bestDomain} = ${bestScore}`);
  return bestDomain;
}

/**
 * Build query text with HEAVY domain keyword weighting to match embedded documents
 */
async function buildDomainWeightedQuery(query: string, domain: string, apiKey: string): Promise<string> {
  // Get domain keywords
  const domainKeywords = DOMAIN_KEYWORDS[domain] || [];
  
  // Expand query with AI
  let aiExpansion = '';
  try {
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
            content: `You are a database schema expert. Given a business requirement, list the specific table names and column names that would be needed. Focus on ${domain} domain tables. Output a comma-separated list of 15-20 table/column names like: Room_Table, Guest_Profile, Reservation_Details, booking_date, check_in_time, etc.`,
          },
          {
            role: 'user',
            content: query,
          },
        ],
        max_tokens: 200,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      aiExpansion = data.choices?.[0]?.message?.content?.trim() || '';
    }
  } catch (e) {
    console.error('AI expansion error:', e);
  }

  // Build weighted query text that matches the embedded document format
  const queryParts = [
    // Original query
    query,
    
    // Domain signal (repeat for weight - matches embed format)
    `Domain: ${domain}. ${domain} domain. ${domain} system.`,
    
    // Domain keywords (matches embed format)
    `Domain keywords: ${domainKeywords.slice(0, 15).join(', ')}`,
    
    // AI expansion
    aiExpansion ? `Tables: ${aiExpansion}` : '',
    
    // Additional domain repetition for strong matching
    domain !== 'General' ? `${domain}: ${domainKeywords.slice(0, 10).join(' ')}` : '',
  ];

  return queryParts.filter(Boolean).join('. ');
}

/**
 * Generate embedding - MUST MATCH embed-types function EXACTLY
 */
function generateEmbedding(text: string, dimensions: number = EMBEDDING_DIMENSIONS): number[] {
  const embedding = new Array(dimensions).fill(0);
  const lowerText = text.toLowerCase();
  
  // Split into words
  const words = lowerText.split(/[\s,.\-_:;()]+/).filter(w => w.length > 1);
  
  // Identify domain keywords and weight them HEAVILY
  const domainKeywordWeights: Record<string, number> = {};
  for (const keywords of Object.values(DOMAIN_KEYWORDS)) {
    for (const kw of keywords) {
      domainKeywordWeights[kw] = 15;
    }
  }
  
  // Process each word with domain-aware weighting
  for (const word of words) {
    let hash = 0;
    for (let j = 0; j < word.length; j++) {
      hash = ((hash << 5) - hash + word.charCodeAt(j)) | 0;
    }
    
    const weight = domainKeywordWeights[word] || 1;
    
    const idx1 = Math.abs(hash) % dimensions;
    const idx2 = Math.abs(hash * 31) % dimensions;
    const idx3 = Math.abs(hash * 97) % dimensions;
    
    embedding[idx1] += 3 * weight;
    embedding[idx2] += 2 * weight;
    embedding[idx3] += 1 * weight;
  }
  
  // Bigram features with domain weighting
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = words[i] + ' ' + words[i + 1];
    let hash = 0;
    for (let j = 0; j < bigram.length; j++) {
      hash = ((hash << 5) - hash + bigram.charCodeAt(j)) | 0;
    }
    
    let bigramWeight = 1;
    for (const keywords of Object.values(DOMAIN_KEYWORDS)) {
      if (keywords.includes(bigram)) {
        bigramWeight = 20;
        break;
      }
    }
    
    const idx = Math.abs(hash) % dimensions;
    embedding[idx] += 4 * bigramWeight;
  }
  
  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < dimensions; i++) {
      embedding[i] = embedding[i] / magnitude;
    }
  }
  
  return embedding;
}

/**
 * Query Pinecone
 */
async function queryPinecone(
  indexHost: string,
  apiKey: string,
  vector: number[],
  topK: number,
  filter: Record<string, unknown>
): Promise<QueryResult[]> {
  const queryBody: Record<string, unknown> = {
    vector,
    topK,
    includeMetadata: true,
    namespace: 'payanarss-types',
  };

  if (Object.keys(filter).length > 0) {
    queryBody.filter = filter;
  }

  const response = await fetch(`https://${indexHost}/query`, {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(queryBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Pinecone query error:', errorText);
    throw new Error(`Pinecone query failed: ${errorText}`);
  }

  const data = await response.json();
  return (data.matches || []).map((match: { id: string; score: number; metadata: Record<string, unknown> }) => ({
    id: match.id,
    score: match.score,
    metadata: match.metadata,
  }));
}

/**
 * Generate AI summary
 */
async function generateAISummary(
  query: string,
  domain: string,
  results: QueryResult[],
  apiKey: string
): Promise<string> {
  if (results.length === 0) {
    return 'No matching types found. Try describing your business needs differently or re-embed the types from the Admin tab.';
  }

  try {
    const coreTypes = results.filter(r => r.metadata.purpose === 'Core');
    const lookupTypes = results.filter(r => r.metadata.purpose === 'Lookup');
    const supportingTypes = results.filter(r => r.metadata.purpose === 'Supporting' || r.metadata.purpose === 'Relationship');

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
            content: `You are an ERP solution architect. Provide a structured recommendation for building the user's ${domain} module. Format:

**Recommended Core Tables:**
[List main tables with brief explanation]

**Supporting & Lookup Tables:**
[List supporting tables]

**Suggested Workflows:**
[2-3 key workflows]

**Implementation Priority:**
[What to implement first]

Keep under 300 words.`,
          },
          {
            role: 'user',
            content: `User requirement: "${query}"
Domain: ${domain}

Core Tables (${coreTypes.length}):
${coreTypes.slice(0, 5).map(r => `- ${r.metadata.name} (${(r.score * 100).toFixed(0)}%)`).join('\n')}

Lookup Tables (${lookupTypes.length}):
${lookupTypes.slice(0, 5).map(r => `- ${r.metadata.name}`).join('\n')}

Supporting Tables (${supportingTypes.length}):
${supportingTypes.slice(0, 5).map(r => `- ${r.metadata.name}`).join('\n')}`,
          },
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      return `Found ${results.length} relevant types for ${domain}. Top: ${results.slice(0, 5).map(r => r.metadata.name).join(', ')}.`;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
  } catch {
    return `Found ${results.length} matching types. Top: ${results.slice(0, 5).map(r => r.metadata.name).join(', ')}.`;
  }
}
