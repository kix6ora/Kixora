import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { registerServiceWorker } from '../../src/pwa/registerServiceWorker';

const swPath = path.resolve(process.cwd(), 'public/sw.js');
const swSource = readFileSync(swPath, 'utf8');

describe('service worker', () => {
  it('contains the build id placeholder', () => {
    expect(swSource).toContain('__KIXORA_BUILD_ID__');
  });

  it('returns early for /api/ before any respondWith', () => {
    const apiIndex = swSource.indexOf("startsWith('/api/')");
    const respondIndex = swSource.indexOf('respondWith');
    expect(apiIndex).toBeGreaterThan(-1);
    expect(respondIndex).toBeGreaterThan(-1);
    expect(apiIndex).toBeLessThan(respondIndex);
  });

  it('has a network-first navigation branch', () => {
    expect(swSource).toContain("mode === 'navigate'");
    expect(swSource).toContain("caches.match('/index.html')");
  });

  it('uses skipWaiting, clients.claim, SKIP_WAITING listener, and caches.delete on activate', () => {
    expect(swSource).toContain('skipWaiting');
    expect(swSource).toContain('clients.claim');
    expect(swSource).toContain('SKIP_WAITING');
    expect(swSource).toContain('caches.delete');
  });

  it('only calls cache.put inside the /assets/ branch', () => {
    const assetsIndex = swSource.indexOf("startsWith('/assets/')");
    const putIndex = swSource.indexOf('cache.put');
    expect(assetsIndex).toBeGreaterThan(-1);
    expect(putIndex).toBeGreaterThan(assetsIndex);
    const beforeAssets = swSource.slice(0, assetsIndex);
    expect(beforeAssets).not.toContain('cache.put');
  });
});

describe('registerServiceWorker', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it('registers /sw.js with no version query', async () => {
    const postMessage = vi.fn();
    const register = vi.fn().mockResolvedValue({ waiting: { postMessage } });
    vi.stubGlobal('navigator', { serviceWorker: { register } });

    await registerServiceWorker();

    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith('/sw.js');
    expect(register.mock.calls[0][0]).not.toContain('?');
    expect(postMessage).toHaveBeenCalledWith('SKIP_WAITING');
  });
});
