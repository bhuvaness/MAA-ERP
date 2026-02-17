import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const EMBEDDING_DIMENSIONS = 1024;
const DEFAULT_NAMESPACE = 'payanarss-types';

// Domain types with HEAVY keyword weighting for accurate matching
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

// Purpose classification keywords
const PURPOSE_KEYWORDS: Record<string, string[]> = {
  Core: ['table', 'master', 'main', 'primary', 'entity', 'record', 'core'],
  Lookup: ['lookup', 'status', 'type', 'category', 'classification', 'code', 'reference', 'enum'],
  Supporting: ['history', 'log', 'audit', 'detail', 'line', 'item', 'child', 'supporting'],
  Relationship: ['mapping', 'link', 'association', 'junction', 'bridge', 'relation'],
};

interface PayanarssType {
  Id: string;
  ParentId: string;
  Name: string;
  PayanarssTypeId: string;
  Attributes: (number | { Id: string; Value: string })[];
  Description: string | null;
}

interface EnrichedTypeMetadata {
  name: string;
  parentId: string;
  payanarssTypeId: string;
  description: string;
  hasAttributes: boolean;
  domain: string;
  purpose: string;
  module: string;
  keywords: string;
  parentName: string;
  childCount: number;
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

    const { types, indexHost, namespace, batchSize } = await req.json();

    if (!indexHost) {
      throw new Error('indexHost is required');
    }

    if (!Array.isArray(types) || types.length === 0) {
      throw new Error('types[] array is required and must not be empty');
    }

    const resolvedTypes: PayanarssType[] = types;
    const resolvedNamespace = namespace || DEFAULT_NAMESPACE;
    const resolvedBatchSize = Math.min(batchSize || 20, 50);

    console.log(`Processing ${resolvedTypes.length} types for embedding with domain-weighted vectors...`);

    const results = [];

    for (let i = 0; i < resolvedTypes.length; i += resolvedBatchSize) {
      const batch = resolvedTypes.slice(i, i + resolvedBatchSize);
      const batchNum = Math.floor(i / resolvedBatchSize) + 1;
      console.log(`Processing batch ${batchNum}...`);

      // Step 1: Generate enriched text with domain-weighted keywords
      const enrichedData = await Promise.all(
        batch.map((type) => enrichTypeForEmbedding(type, resolvedTypes, LOVABLE_API_KEY))
      );

      // Step 2: Generate embeddings
      const embeddings = enrichedData.map(d => generateEmbedding(d.embeddingText));

      if (!embeddings || embeddings.length !== batch.length) {
        throw new Error(`Failed to generate embeddings for batch ${batchNum}`);
      }

      // Step 3: Prepare vectors with metadata
      const vectors = batch.map((type, idx) => ({
        id: type.Id,
        values: embeddings[idx],
        metadata: enrichedData[idx].metadata,
      }));

      // Step 4: Upsert to Pinecone
      const upsertResponse = await fetch(`https://${indexHost}/vectors/upsert`, {
        method: 'POST',
        headers: {
          'Api-Key': PINECONE_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vectors,
          namespace: resolvedNamespace,
        }),
      });

      if (!upsertResponse.ok) {
        const errorText = await upsertResponse.text();
        console.error('Pinecone upsert error:', errorText);
        throw new Error(`Pinecone upsert failed: ${errorText}`);
      }

      const upsertData = await upsertResponse.json();
      console.log(`Batch ${batchNum} upserted: ${upsertData.upsertedCount || vectors.length} vectors`);

      results.push({
        batch: batchNum,
        count: vectors.length,
        upserted: upsertData.upsertedCount || vectors.length,
      });

      if (i + resolvedBatchSize < resolvedTypes.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalProcessed: resolvedTypes.length,
        batches: results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Embed types error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Generate embedding with HEAVY domain keyword weighting
 */
function generateEmbedding(text: string, dimensions: number = EMBEDDING_DIMENSIONS): number[] {
  const embedding = new Array(dimensions).fill(0);
  const lowerText = text.toLowerCase();
  
  // Split into words
  const words = lowerText.split(/[\s,.\-_:;()]+/).filter(w => w.length > 1);
  
  // Identify domain keywords and weight them HEAVILY
  const domainKeywordWeights: Record<string, number> = {};
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    for (const kw of keywords) {
      domainKeywordWeights[kw] = 15; // Very high weight for domain keywords
    }
  }
  
  // Process each word with domain-aware weighting
  for (const word of words) {
    let hash = 0;
    for (let j = 0; j < word.length; j++) {
      hash = ((hash << 5) - hash + word.charCodeAt(j)) | 0;
    }
    
    // Check if this is a domain keyword
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
    
    // Check for domain bigrams
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
 * Classify domain with strict keyword matching
 */
function classifyDomain(typeName: string, parentName: string, description: string): string {
  const searchText = `${typeName} ${parentName} ${description}`.toLowerCase();
  
  let bestDomain = 'General';
  let bestScore = 0;

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (searchText.includes(kw)) {
        score += kw.split(' ').length; // Multi-word keywords score higher
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestDomain = domain;
    }
  }

  return bestDomain;
}

/**
 * Classify purpose
 */
function classifyPurpose(typeName: string, hasChildren: boolean, attributeCount: number): string {
  const lowerName = typeName.toLowerCase();

  for (const [purpose, keywords] of Object.entries(PURPOSE_KEYWORDS)) {
    if (keywords.some(kw => lowerName.includes(kw))) {
      return purpose;
    }
  }

  if (hasChildren && attributeCount > 3) return 'Core';
  if (attributeCount <= 2) return 'Lookup';
  return 'Supporting';
}

/**
 * Extract keywords from name
 */
function extractKeywordsFromName(name: string): string[] {
  const words = name
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(w => w.length > 2);
  
  return [...new Set(words)];
}

/**
 * Enrich type with HEAVY domain keyword embedding
 */
async function enrichTypeForEmbedding(
  type: PayanarssType,
  allTypes: PayanarssType[],
  apiKey: string
): Promise<{ embeddingText: string; metadata: EnrichedTypeMetadata }> {
  const parent = allTypes.find(t => t.Id === type.ParentId && t.Id !== type.Id);
  const parentName = parent?.Name || '';
  const children = allTypes.filter(t => t.ParentId === type.Id && t.Id !== type.Id);
  const childNames = children.slice(0, 10).map(c => c.Name);
  const typeCategory = allTypes.find(t => t.Id === type.PayanarssTypeId);
  const typeCategoryName = typeCategory?.Name || '';

  const domain = classifyDomain(type.Name, parentName, type.Description || '');
  const purpose = classifyPurpose(type.Name, children.length > 0, type.Attributes.length);
  const nameKeywords = extractKeywordsFromName(type.Name);

  // Get domain-specific keywords for this domain
  const domainKeywordList = DOMAIN_KEYWORDS[domain] || [];
  
  // Generate AI semantic expansion
  const aiKeywords = await generateAISemanticExpansion(type.Name, type.Description || '', domain, purpose, apiKey);

  // Build embedding text with HEAVY domain keyword repetition for strong matching
  const embeddingParts: string[] = [
    // Core identity (repeat domain for strong signal)
    `Domain: ${domain}. ${domain} domain. ${domain} system.`,
    `Table: ${type.Name}`,
    type.Description ? `Description: ${type.Description}` : '',
    
    // Hierarchy
    parentName ? `Parent: ${parentName}` : '',
    typeCategoryName ? `Category: ${typeCategoryName}` : '',
    childNames.length > 0 ? `Contains: ${childNames.join(', ')}` : '',
    
    // Purpose
    `Purpose: ${purpose} table`,
    
    // CRITICAL: Heavy domain keywords for matching
    `Domain keywords: ${domainKeywordList.slice(0, 15).join(', ')}`,
    
    // AI-generated keywords
    `Business keywords: ${[...nameKeywords, ...aiKeywords].join(', ')}`,
    
    // Repeat domain keywords again for strong signal
    domain !== 'General' ? `${domain}: ${domainKeywordList.slice(0, 10).join(' ')}` : '',
  ];

  const embeddingText = embeddingParts.filter(Boolean).join('. ');

  const metadata: EnrichedTypeMetadata = {
    name: type.Name,
    parentId: type.ParentId,
    payanarssTypeId: type.PayanarssTypeId,
    description: type.Description || '',
    hasAttributes: type.Attributes.length > 0,
    domain,
    purpose,
    module: parentName || type.Name,
    keywords: [...nameKeywords, ...aiKeywords, ...domainKeywordList.slice(0, 10)].join(','),
    parentName,
    childCount: children.length,
  };

  return { embeddingText, metadata };
}

/**
 * AI semantic expansion
 */
async function generateAISemanticExpansion(
  typeName: string,
  description: string,
  domain: string,
  purpose: string,
  apiKey: string
): Promise<string[]> {
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
            content: `You are a database schema expert. Generate semantic keywords for matching natural language queries to this ${domain} domain table. Output ONLY a comma-separated list of 15-20 keywords including business use cases, related processes, and synonyms. Be specific to ${domain}.`,
          },
          {
            role: 'user',
            content: `Table: ${typeName}${description ? `\nDescription: ${description}` : ''}\nDomain: ${domain}\nPurpose: ${purpose}`,
          },
        ],
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const keywords = data.choices?.[0]?.message?.content?.trim() || '';
    
    return keywords
      .split(',')
      .map((k: string) => k.trim().toLowerCase())
      .filter((k: string) => k.length > 2 && k.length < 50);
  } catch {
    return [];
  }
}
