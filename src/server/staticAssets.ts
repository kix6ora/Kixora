import express, { type Express } from 'express';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Production static asset mount.
 *
 * Decisions:
 * - prod: serve the PNG icons declared in public/manifest.json (deterministic
 *   route order), then fall back to the SPA index for everything else.
 */
export function mountProductionStaticAssets(app: Express, distPath: string): void {
  // The service worker script must revalidate on every load so updates apply.
  app.get('/sw.js', (_req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(distPath, 'sw.js'));
  });

  app.use(express.static(distPath));

  app.get('/{*splat}', (req, res) => {
    // Missing asset: return 404 instead of the SPA index (e.g. a missing icon).
    if (/^\/icon-[^/]+\.png$/.test(req.path) && !fs.existsSync(path.join(distPath, req.path.replace(/^\/+/, '')))) {
      return res.sendStatus(404);
    }
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API route not found' });
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

