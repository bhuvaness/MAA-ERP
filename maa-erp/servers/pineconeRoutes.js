/**
 * pineconeRoutes.js
 * =================
 * Express router — Semantic search endpoint.
 *
 * Mount in server.js:
 *   import pineconeRoutes from './pineconeRoutes.js';
 *   app.use('/api', pineconeRoutes);
 *
 * Endpoint:
 *   POST /api/search
 */

import express from 'express';
import { searchPinecone } from './pineconeSearchService.js';

const router = express.Router();

// ─── POST /api/search ─────────────────────────────────────────
router.post('/search', async (req, res) => {
  const { prompt, topK } = req.body;

  // Validation
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({
      success: false,
      error: 'prompt is required and must be a non-empty string.',
    });
  }

  const k = Number.isInteger(topK) && topK > 0 && topK <= 20 ? topK : 5;

  try {
    const result = await searchPinecone(prompt.trim(), k);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('[pinecone] Search error:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message ?? 'Pinecone search failed.',
    });
  }
});

export default router;
