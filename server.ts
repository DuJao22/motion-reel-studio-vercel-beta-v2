import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import app from './api/index.ts';

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const BASE_DIR = process.cwd();

async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(BASE_DIR, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Motion Reel Studio server running on port ${PORT}`);
  });
}

startServer();

export default app;
