import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Serve index.html for all routes (SPA)
import fs from 'fs';

function renderIndex() {
  let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const apiBase = process.env.API_BASE || '';
  html = html.replace(/%%API_BASE%%/g, apiBase);
  return html;
}

app.get('/', (req, res) => {
  res.send(renderIndex());
});

app.get('*', (req, res) => {
  res.send(renderIndex());
});

app.listen(PORT, () => {
  console.log(`🚀 SmartAMS Frontend running at http://localhost:${PORT}`);
});
