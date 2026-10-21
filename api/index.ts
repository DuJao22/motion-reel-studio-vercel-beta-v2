import express from 'express';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();

// Base and storage directories (Vercel has read-only root, /tmp is writable)
const isVercel = Boolean(process.env.VERCEL);
const BASE_DIR = process.cwd();
const OUTPUT_DIR = isVercel ? path.join('/tmp', 'output_reels') : path.join(BASE_DIR, 'output_reels');
const KEYS_FILE = isVercel ? path.join('/tmp', 'chaves.txt') : path.join(BASE_DIR, 'chaves.txt');
const REPO_KEYS_FILE = path.join(BASE_DIR, 'chaves.txt');

try {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not create output dir:', e);
}

// Global CORS & JSON parser
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

app.use(express.json({ limit: '10mb' }));

// Restore full path if Vercel URL rewrite rewrote path to /api
app.use((req, res, next) => {
  const matchedPath = req.headers['x-matched-path'];
  if (typeof matchedPath === 'string' && matchedPath.startsWith('/api') && req.url === '/api') {
    req.url = matchedPath;
  }
  next();
});

function getStoredKeys(): string[] {
  const keys: string[] = [];

  // 1. Environment keys have top priority (GEMINI_API_KEY and GEMINI_API_KEYS)
  const envVars = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEYS].filter(Boolean) as string[];
  for (const envVal of envVars) {
    const parts = envVal.split(/[,\s;]+/);
    for (const p of parts) {
      const clean = p.trim().replace(/['"]/g, '');
      if (clean.length >= 25 && clean !== 'MY_GEMINI_API_KEY' && !clean.startsWith('AQ.') && !keys.includes(clean)) {
        keys.push(clean);
      }
    }
  }

  // 2. Persistent file keys (/tmp/chaves.txt on Vercel or local chaves.txt)
  const candidateFiles = [KEYS_FILE, REPO_KEYS_FILE];
  for (const file of candidateFiles) {
    if (fs.existsSync(file)) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        for (const line of lines) {
          const clean = line.split('#')[0].trim().replace(/['"]/g, '');
          if (clean.length >= 25 && !clean.startsWith('AQ.') && clean !== 'MY_GEMINI_API_KEY' && !keys.includes(clean)) {
            keys.push(clean);
          }
        }
      } catch (e) {}
    }
  }

  return keys;
}

function saveKeysToFile(keys: string[]) {
  try {
    const content = keys.filter(k => k.trim().length >= 25 && !k.startsWith('AQ.')).join('\n') + '\n';
    fs.writeFileSync(KEYS_FILE, content, 'utf-8');
  } catch (e) {
    console.warn('Could not write keys file (normal on read-only/serverless runtimes):', e);
  }
}

// In-memory active generation jobs
interface JobState {
  id: string;
  status: 'running' | 'completed' | 'error';
  progressLogs: Array<{ time: string; text: string; data?: any }>;
  dna?: any;
  plan?: any;
  result?: any;
  error?: string;
  listeners: Array<(event: string, data: any) => void>;
}

const activeJobs = new Map<string, JobState>();

// Router containing all API routes so it works seamlessly under both /api and root /
const router = express.Router();

// Healthcheck
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    isVercel,
    timestamp: new Date().toISOString()
  });
});

// 1. Get API Keys
router.get('/keys', (req, res) => {
  const keys = getStoredKeys();
  const masked = keys.map(k => ({
    key: k,
    masked: k.length > 10 ? `${k.slice(0, 6)}...${k.slice(-4)}` : k,
    type: k.startsWith('AIza') ? 'Gemini Standard' : 'API Key',
    length: k.length
  }));
  res.json({ keys, masked, count: keys.length });
});

// 2. Save API Keys
router.post('/keys', (req, res) => {
  const { keys } = req.body;
  if (!Array.isArray(keys)) {
    return res.status(400).json({ error: 'keys must be an array of strings' });
  }
  const cleanKeys: string[] = [];
  for (const k of keys) {
    const clean = String(k).trim().replace(/['"]/g, '');
    if (clean.length >= 25 && !clean.startsWith('AQ.') && !cleanKeys.includes(clean)) {
      cleanKeys.push(clean);
    }
  }
  saveKeysToFile(cleanKeys);
  res.json({ success: true, count: cleanKeys.length });
});

// 3. Reset keys
router.post('/keys/reset', (req, res) => {
  if (fs.existsSync(KEYS_FILE)) {
    try {
      fs.writeFileSync(KEYS_FILE, '# Chaves de API Gemini\n', 'utf-8');
    } catch (e) {}
  }
  const keys = getStoredKeys();
  res.json({ success: true, count: keys.length, keys });
});

// 3.1. Proxy Gemini Generation (Server-Side Proxy avoiding CORS/CSP issues)
router.post('/gemini/generate', async (req, res) => {
  const { prompt, json: isJson, temperature, keys: clientKeys } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt é obrigatório' });
  }

  // Collect candidate keys in priority order
  const candidateKeys: string[] = [];

  // 1. Env keys (GEMINI_API_KEY, GEMINI_API_KEYS)
  const envVars = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEYS].filter(Boolean) as string[];
  for (const envVal of envVars) {
    const parts = envVal.split(/[,\s;]+/);
    for (const p of parts) {
      const clean = p.trim().replace(/['"]/g, '');
      if (clean.length >= 25 && clean !== 'MY_GEMINI_API_KEY' && !clean.startsWith('AQ.') && !candidateKeys.includes(clean)) {
        candidateKeys.push(clean);
      }
    }
  }

  // 2. Client keys from user settings
  if (Array.isArray(clientKeys)) {
    for (const k of clientKeys) {
      const clean = String(k).trim().replace(/['"]/g, '');
      if (clean.length >= 25 && !clean.startsWith('AQ.') && !candidateKeys.includes(clean)) {
        candidateKeys.push(clean);
      }
    }
  }

  // 3. Server stored keys
  for (const k of getStoredKeys()) {
    if (k !== 'MY_GEMINI_API_KEY' && !candidateKeys.includes(k)) {
      candidateKeys.push(k);
    }
  }

  // Supported valid Gemini models
  const models = ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

  // Try candidate keys
  if (candidateKeys.length > 0) {
    for (const apiKey of candidateKeys) {
      for (const model of models) {
        try {
          const ai = new GoogleGenAI({ apiKey });
          const config: any = {
            temperature: typeof temperature === 'number' ? temperature : 0.85
          };
          if (isJson) {
            config.responseMimeType = 'application/json';
          }
          const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config
          });
          const text = response.text;
          if (text && text.trim()) {
            return res.json({ text, model, success: true });
          }
        } catch (err: any) {
          console.warn(`[Gemini Proxy] Key ${apiKey.slice(0, 6)}... (${model}) error:`, err?.message || err);
        }
      }
    }
  }

  // Also try default instance without explicit key in case environment has ambient credentials
  for (const model of models) {
    try {
      const ai = new GoogleGenAI();
      const config: any = {
        temperature: typeof temperature === 'number' ? temperature : 0.85
      };
      if (isJson) {
        config.responseMimeType = 'application/json';
      }
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config
      });
      const text = response.text;
      if (text && text.trim()) {
        return res.json({ text, model, success: true });
      }
    } catch (e) {
      // Continue
    }
  }

  // If no keys succeeded, return offline indicator safely without crashing
  return res.json({
    text: null,
    offline: true,
    message: 'Nenhuma chave Gemini válida disponível no momento. Utilizando renderização procedural animada.'
  });
});

// 3.2. Proxy Gemini Text-to-Speech (Humanized TTS Voice Narration)
router.post('/gemini/tts', async (req, res) => {
  const { text, voice, style, keys: clientKeys } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Texto da narração é obrigatório' });
  }

  const candidateKeys: string[] = [];

  const envVars = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEYS].filter(Boolean) as string[];
  for (const envVal of envVars) {
    const parts = envVal.split(/[,\s;]+/);
    for (const p of parts) {
      const clean = p.trim().replace(/['"]/g, '');
      if (clean.length >= 25 && clean !== 'MY_GEMINI_API_KEY' && !clean.startsWith('AQ.') && !candidateKeys.includes(clean)) {
        candidateKeys.push(clean);
      }
    }
  }

  if (Array.isArray(clientKeys)) {
    for (const k of clientKeys) {
      const clean = String(k).trim().replace(/['"]/g, '');
      if (clean.length >= 25 && !clean.startsWith('AQ.') && !candidateKeys.includes(clean)) {
        candidateKeys.push(clean);
      }
    }
  }

  for (const k of getStoredKeys()) {
    if (k !== 'MY_GEMINI_API_KEY' && !candidateKeys.includes(k)) {
      candidateKeys.push(k);
    }
  }

  const voiceName = voice && voice !== 'none' ? voice : 'Kore';
  const voiceStyle = style || 'Natural, warm, conversational, humanized narrator in Brazilian Portuguese';
  const ttsModels = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'];

  // Try candidate keys
  if (candidateKeys.length > 0) {
    for (const apiKey of candidateKeys) {
      for (const model of ttsModels) {
        try {
          const ai = new GoogleGenAI({ apiKey });
          const response = await ai.models.generateContent({
            model,
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: text.trim(),
                    speechMetadata: {
                      style: voiceStyle
                    }
                  }
                ]
              }
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName }
                }
              }
            }
          });

          const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (audioBase64) {
            return res.json({
              success: true,
              audioBase64,
              mimeType: 'audio/wav',
              voice: voiceName,
              model
            });
          }
        } catch (err: any) {
          // Retry without speechMetadata if style was not accepted
          try {
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
              model,
              contents: [{ role: 'user', parts: [{ text: text.trim() }] }],
              config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName }
                  }
                }
              }
            });
            const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (audioBase64) {
              return res.json({
                success: true,
                audioBase64,
                mimeType: 'audio/wav',
                voice: voiceName,
                model
              });
            }
          } catch (e2) {}
          console.warn(`[Gemini TTS] Key ${apiKey.slice(0, 6)}... (${model}) error:`, err?.message || err);
        }
      }
    }
  }

  // Also try default environment credentials
  for (const model of ttsModels) {
    try {
      const ai = new GoogleGenAI();
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: text.trim()
              }
            ]
          }
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName }
            }
          }
        }
      });

      const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (audioBase64) {
        return res.json({
          success: true,
          audioBase64,
          mimeType: 'audio/wav',
          voice: voiceName,
          model
        });
      }
    } catch (e) {
      // Continue
    }
  }

  return res.json({
    success: false,
    offline: true,
    message: 'Narração de voz gerada via sintetizador nativo de fala.'
  });
});

// 4. Get Configuration presets and constants
router.get('/config/presets', (req, res) => {
  res.json({
    styles: [
      { id: 1, name: 'Minimalista e elegante', desc: 'Espaço vazio, linhas finas, círculos, movimento lento e tipografia leve' },
      { id: 2, name: 'Cinematográfico e dramático', desc: 'Alto contraste, vinheta, luz e sombra, letterbox, zoom lento e serifas dramáticas' },
      { id: 3, name: 'Futurista e tecnológico', desc: 'HUD interfaces, wireframes, grades 3D, scanlines, dados digitais e brilho neon' },
      { id: 4, name: 'Colorido e energético', desc: 'Formas vibrantes, cores saturadas, movimento elástico e círculos em explosão' },
      { id: 5, name: 'Editorial e tipográfico', desc: 'Tipografia como protagonista, grid editorial, filetes, números gigantes e serifa elegante' },
      { id: 6, name: 'Surpresa (Design Aleatório)', desc: 'DNA e estilo combinados de forma imprevisível e única pelo gerador' }
    ],
    resolutions: [
      { id: 1, width: 540, height: 960, label: '540 x 960 (Rápido / Teste)' },
      { id: 2, width: 720, height: 1280, label: '720 x 1280 (Recomendado 9:16)' },
      { id: 3, width: 1080, height: 1920, label: '1080 x 1920 (Qualidade Máxima)' }
    ],
    framerates: [
      { value: 24, label: '24 FPS (Cinema & Leve)' },
      { value: 30, label: '30 FPS (Movimento Suave)' }
    ],
    voices: [
      { id: 'Kore', label: 'Kore (Firme e Clara)' },
      { id: 'Puck', label: 'Puck (Animada e Dinâmica)' },
      { id: 'Charon', label: 'Charon (Informativa e Grave)' },
      { id: 'Aoede', label: 'Aoede (Leve e Suave)' },
      { id: 'Sulafat', label: 'Sulafat (Calorosa e Natural)' },
      { id: 'none', label: 'Sem Narração (Apenas Batida Sintetizada)' }
    ],
    efforts: [
      { id: 1, name: 'Rápido', desc: '1 chamada direta de código por cena' },
      { id: 2, name: 'Equilibrado', desc: '2 chamadas: planeja coreografia e escreve código (Recomendado)' },
      { id: 3, name: 'Máximo', desc: '3 chamadas: planeja, escreve e refina cada cena com IA' }
    ],
    accentPresets: ['#FFB454', '#38bdf8', '#a855f7', '#22c55e', '#ef4444', '#f43f5e', '#eab308']
  });
});

// 5. Start Generation Job (Backend Python runner, optional when local python3 is present)
router.post('/generate', (req, res) => {
  const { prompt, options } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt é obrigatório' });
  }

  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const currentKeys = getStoredKeys();

  const job: JobState = {
    id: jobId,
    status: 'running',
    progressLogs: [],
    listeners: []
  };
  activeJobs.set(jobId, job);

  const pythonPayload = {
    prompt: prompt.trim(),
    options: {
      keys: currentKeys,
      style_idx: options?.style || 2,
      resolution_idx: options?.resolution || 2,
      fps: options?.fps || 24,
      accent: options?.accent || '#FFB454',
      effort: options?.effort || 2,
      voice: options?.voice || 'Kore'
    }
  };

  try {
    const pyProcess = spawn('python3', [path.join(BASE_DIR, 'motion_reel_studio.py'), '--api']);

    pyProcess.stdin.write(JSON.stringify(pythonPayload));
    pyProcess.stdin.end();

    let stdoutData = '';

    pyProcess.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
      const lines = stdoutData.split('\n');
      stdoutData = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('EVENT:')) {
          try {
            const eventData = JSON.parse(line.substring(6));
            const timestamp = new Date().toLocaleTimeString();
            job.progressLogs.push({ time: timestamp, text: eventData.message || eventData.step, data: eventData });
            
            if (eventData.dna) job.dna = eventData.dna;
            if (eventData.scenes) job.plan = eventData;

            for (const listener of job.listeners) {
              listener('event', eventData);
            }
          } catch (e) {
            console.error('Error parsing EVENT line:', e);
          }
        } else if (line.startsWith('FINAL:')) {
          try {
            const finalResult = JSON.parse(line.substring(6));
            job.status = 'completed';
            job.result = finalResult;
            for (const listener of job.listeners) {
              listener('complete', finalResult);
            }
          } catch (e) {
            console.error('Error parsing FINAL line:', e);
          }
        }
      }
    });

    pyProcess.stderr.on('data', (errChunk) => {
      const errText = errChunk.toString();
      console.error('Python stderr:', errText);
      job.progressLogs.push({ time: new Date().toLocaleTimeString(), text: `[stderr] ${errText}` });
    });

    pyProcess.on('error', (err) => {
      console.error('Python spawn error:', err);
      job.status = 'error';
      job.error = `Python indisponível neste ambiente: ${err.message}`;
      job.progressLogs.push({ time: new Date().toLocaleTimeString(), text: job.error });
      for (const listener of job.listeners) {
        listener('error', { error: job.error });
      }
    });

    pyProcess.on('close', (code) => {
      if (code !== 0 && job.status !== 'completed') {
        job.status = 'error';
        job.error = `Process exited with code ${code}`;
        for (const listener of job.listeners) {
          listener('error', { error: job.error });
        }
      }
    });

    res.json({ jobId, message: 'Geração iniciada com o backend Python' });
  } catch (err: any) {
    job.status = 'error';
    job.error = err.message;
    res.status(500).json({ error: err.message });
  }
});

// 6. SSE Stream for Live Job Progress
router.get('/generation/stream/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = activeJobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job não encontrado' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  for (const log of job.progressLogs) {
    res.write(`data: ${JSON.stringify({ type: 'log', log })}\n\n`);
  }

  if (job.status === 'completed' && job.result) {
    res.write(`data: ${JSON.stringify({ type: 'complete', result: job.result })}\n\n`);
    return res.end();
  }

  if (job.status === 'error') {
    res.write(`data: ${JSON.stringify({ type: 'error', error: job.error })}\n\n`);
    return res.end();
  }

  const listener = (type: string, data: any) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
    if (type === 'complete' || type === 'error') {
      res.end();
    }
  };

  job.listeners.push(listener);

  req.on('close', () => {
    job.listeners = job.listeners.filter(l => l !== listener);
  });
});

// 7. Get Job Status
router.get('/generation/status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = activeJobs.get(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job não encontrado' });
  }
  res.json({
    id: job.id,
    status: job.status,
    logs: job.progressLogs,
    dna: job.dna,
    plan: job.plan,
    result: job.result,
    error: job.error
  });
});

// 8. List all generated showreels
router.get('/reels', (req, res) => {
  try {
    if (!fs.existsSync(OUTPUT_DIR)) {
      return res.json({ reels: [] });
    }
    const files = fs.readdirSync(OUTPUT_DIR);
    const htmlFiles = files
      .filter(f => f.startsWith('showreel_') && f.endsWith('.html'))
      .sort()
      .reverse();

    const reels = htmlFiles.map(f => {
      const id = f.replace('showreel_', '').replace('.html', '');
      const filePath = path.join(OUTPUT_DIR, f);
      const stat = fs.statSync(filePath);
      
      let title = `Showreel ${id}`;
      try {
        const contentHead = fs.readFileSync(filePath, 'utf-8').slice(0, 3000);
        const match = contentHead.match(/"title":\s*"([^"]+)"/);
        if (match && match[1]) {
          title = match[1];
        }
      } catch (e) {}

      return {
        id,
        filename: f,
        title,
        createdAt: stat.mtime,
        size: stat.size,
        htmlUrl: `/api/reels/${id}/html`
      };
    });

    res.json({ reels });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Serve the standalone HTML file of a reel
router.get('/reels/:id/html', (req, res) => {
  const { id } = req.params;
  const targetFile = path.join(OUTPUT_DIR, `showreel_${id}.html`);
  if (!fs.existsSync(targetFile)) {
    return res.status(404).send('Showreel HTML não encontrado');
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.sendFile(targetFile);
});

// 10. Serve the full scenes JS code bundle
router.get('/reels/:id/code', (req, res) => {
  const { id } = req.params;
  const targetFile = path.join(OUTPUT_DIR, `codigo_${id}`, 'todas_as_cenas.js');
  if (fs.existsSync(targetFile)) {
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="showreel_codigo_${id}.js"`);
    return res.sendFile(targetFile);
  }
  res.status(404).send('Código JS não encontrado');
});

// Mount the router at both /api and / so all requests resolve regardless of how Vercel rewrites them
app.use('/api', router);
app.use('/', router);

export default app;
