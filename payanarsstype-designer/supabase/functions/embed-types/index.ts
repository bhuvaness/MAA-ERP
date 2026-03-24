import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * THIN PROXY — receives pre-enriched records from the browser
 * and upserts them to Pinecone. No heavy processing here.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PINECONE_API_KEY = Deno.env.get('PINECONE_API_KEY');
    if (!PINECONE_API_KEY) throw new Error('PINECONE_API_KEY is not configured');

    const { records, indexHost, namespace } = await req.json();

    if (!indexHost) throw new Error('indexHost is required');
    if (!Array.isArray(records) || records.length === 0) {
      throw new Error('records[] required');
    }

    const resolvedNamespace = namespace || 'payanarss-types';

    console.log(`Upserting ${records.length} records to Pinecone...`);

    // Try integrated inference first (send text, Pinecone embeds)
    let method = 'integrated_inference';
    let upserted = 0;

    try {
      const pineconeRecords = records.map((r: { id: string; text: string; metadata: Record<string, unknown> }) => ({
        _id: r.id,
        text: r.text,
        ...r.metadata,
      }));

      const resp = await fetch(`https://${indexHost}/records/upsert`, {
        method: 'POST',
        headers: { 'Api-Key': PINECONE_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: pineconeRecords, namespace: resolvedNamespace }),
      });

      if (resp.ok) {
        upserted = records.length;
      } else {
        const errText = await resp.text();
        console.warn(`Integrated inference failed (${resp.status}): ${errText}`);
        method = 'fallback_vector';
      }
    } catch (e) {
      console.warn(`Integrated inference error: ${e}`);
      method = 'fallback_vector';
    }

    // Fallback: hash-based embedding + standard vector upsert
    if (method === 'fallback_vector') {
      const vectors = records.map((r: { id: string; text: string; metadata: Record<string, unknown> }) => ({
        id: r.id,
        values: hashEmbed(r.text),
        metadata: r.metadata,
      }));

      const resp = await fetch(`https://${indexHost}/vectors/upsert`, {
        method: 'POST',
        headers: { 'Api-Key': PINECONE_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ vectors, namespace: resolvedNamespace }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Pinecone upsert failed: ${errText}`);
      }

      const data = await resp.json();
      upserted = data.upsertedCount || vectors.length;
    }

    console.log(`Upserted ${upserted} records via ${method}`);

    return new Response(
      JSON.stringify({ success: true, upserted, method }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Embed error:', msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/** Simple hash-based embedding fallback */
function hashEmbed(text: string, dim = 1024): number[] {
  const v = new Array(dim).fill(0);
  const words = text.toLowerCase().split(/[\s,.\-_:;()]+/).filter(w => w.length > 1);
  const freq: Record<string, number> = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;
  for (const [word, count] of Object.entries(freq)) {
    let h = 0;
    for (let j = 0; j < word.length; j++) h = ((h << 5) - h + word.charCodeAt(j)) | 0;
    const wt = Math.log(1 + count);
    v[Math.abs(h) % dim] += 3 * wt;
    v[Math.abs(h * 31) % dim] += 2 * wt;
    v[Math.abs(h * 97) % dim] += 1 * wt;
  }
  for (let i = 0; i < words.length - 1; i++) {
    const bg = words[i] + '_' + words[i + 1];
    let h = 0;
    for (let j = 0; j < bg.length; j++) h = ((h << 5) - h + bg.charCodeAt(j)) | 0;
    v[Math.abs(h) % dim] += 4;
  }
  const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  if (mag > 0) for (let i = 0; i < dim; i++) v[i] /= mag;
  return v;
}
