import express, { type Express } from 'express';
import path from 'node:path';

export function mountProductionStaticAssets(app: Express, distPath: string): void {
  app.use(express.static(distPath));

  app.get(/^\/icon-[^/]+\.png$/, (_req, res) => {
    res.sendStatus(404);
  });

  app.get('/{*splat}', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API route not found' });
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}
