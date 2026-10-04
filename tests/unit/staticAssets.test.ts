import { afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
});
