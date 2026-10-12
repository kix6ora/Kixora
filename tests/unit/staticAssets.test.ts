import { afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mountProductionStaticAssets } from '../../src/server/staticAssets';

const publicPath = path.resolve(process.cwd(), 'public');
let staticRoot: string | undefined;
let server: ReturnType<ReturnType<typeof express>['listen']> | undefined;

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server?.close(error => error ? reject(error) : resolve());
    });
    server = undefined;
  }
  if (staticRoot) {
    rmSync(staticRoot, { recursive: true, force: true });
    staticRoot = undefined;
  }
});

describe('production static assets', () => {
  it('validates PNG icons at the manifest paths and dimensions', () => {
    const manifest = JSON.parse(readFileSync(path.join(publicPath, 'manifest.json'), 'utf8')) as {
      icons: Array<{ src: string; sizes: string; type: string }>;
    };
    const expectedIcons = [
      { src: '/icon-192.png', sizes: '192x192' },
      { src: '/icon-512.png', sizes: '512x512' },
    ];

    expectedIcons.forEach(expected => {
      const icon = manifest.icons.find(entry => entry.src === expected.src);
      expect(icon).toMatchObject({ ...expected, type: 'image/png' });

      const bytes = readFileSync(path.join(publicPath, expected.src.slice(1)));
      expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect(bytes.readUInt32BE(16)).toBe(Number(expected.sizes.split('x')[0]));
      expect(bytes.readUInt32BE(20)).toBe(Number(expected.sizes.split('x')[1]));
    });
  });

  it('returns 404 for a missing icon instead of the SPA index', async () => {
    staticRoot = mkdtempSync(path.join(tmpdir(), 'kixora-static-test-'));
    writeFileSync(path.join(staticRoot, 'index.html'), '<html>SPA</html>');

    const app = express();
    mountProductionStaticAssets(app, staticRoot);
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server?.once('listening', resolve));

    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port.');
    const response = await fetch(`http://127.0.0.1:${address.port}/icon-missing.png`);

    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain('SPA');
  });

  it('serves every manifest icon over HTTP with the declared content type', async () => {
    const manifest = JSON.parse(readFileSync(path.join(publicPath, 'manifest.json'), 'utf8')) as {
      icons: Array<{ src: string; type: string }>;
    };
    expect(manifest.icons.length).toBeGreaterThan(0);

    staticRoot = mkdtempSync(path.join(tmpdir(), 'kixora-static-test-'));
    writeFileSync(path.join(staticRoot, 'index.html'), '<html>SPA</html>');
    // Serve the real public/ icons so the assertions cover the shipped files.
    manifest.icons.forEach(icon => {
      copyFileSync(path.join(publicPath, icon.src.slice(1)), path.join(staticRoot!, icon.src.slice(1)));
    });

    const app = express();
    mountProductionStaticAssets(app, staticRoot);
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server?.once('listening', resolve));

    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port.');
    const origin = `http://127.0.0.1:${address.port}`;

    for (const icon of manifest.icons) {
      const response = await fetch(`${origin}${icon.src}`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain(icon.type);
    }

    // A concrete missing icon must 404 with a body that is not the SPA index.
    const missing = await fetch(`${origin}/icon-999.png`);
    const indexHtml = readFileSync(path.join(staticRoot, 'index.html'), 'utf8');
    expect(missing.status).toBe(404);
    expect(await missing.text()).not.toBe(indexHtml);
  });
});
