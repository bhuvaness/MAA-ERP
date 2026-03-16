import express from 'express';
import cors    from 'cors';
import path    from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

import transactionRoutes from './transactionRoutes.js';
import pineconeRoutes    from './pineconeRoutes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Allow Vite dev server to call this API
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', transactionRoutes);   // POST /api/transactions/save
app.use('/api', pineconeRoutes);      // POST /api/search

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('MAA ERP API running on http://localhost:' + PORT);
  console.log('  POST /api/transactions/save');
  console.log('  POST /api/search');
});
