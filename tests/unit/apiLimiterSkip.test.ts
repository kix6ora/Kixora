import { afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { isRateLimitExempt } from '../../src/server/rateLimitSkip';

let server: ReturnType<ReturnType<typeof express>['listen']> | undefined;

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server?.close(error => (error ? reject(error) : resolve()));
    });
    server = undefined;
  }
});

describe('isRateLimitExempt', () => {
  it('exempts /health and /ready relative to the /api/ mount', () => {
    expect(isRateLimitExempt('/health')).toBe(true);
    expect(isRateLimitExempt('/ready')).toBe(true);
  });

  it('does not exempt absolute /api/* paths or other routes', () => {
    expect(isRateLimitExempt('/api/health')).toBe(false);
    expect(isRateLimitExempt('/payments/payfast/status')).toBe(false);
  });
});

describe('apiLimiter skip exemption', () => {
  async function startApp(): Promise<string> {
    const app = express();
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per window
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests, please try again later.' },
      skip: req => isRateLimitExempt(req.path),
    });
    // Mount the limiter exactly like server.ts does.
    app.use('/api/', limiter);
    app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
    app.get('/api/ready', (_req, res) => res.json({ status: 'ready' }));
    app.get('/api/probe', (_req, res) => res.json({ ok: true }));

    server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server?.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Test server did not bind to a TCP port.');
    }
    return `http://127.0.0.1:${address.port}`;
  }

  it('never returns 429 for /api/health and /api/ready beyond 100 requests', { timeout: 30000 }, async () => {
    const origin = await startApp();
    for (const path of ['/api/health', '/api/ready']) {
      for (let i = 0; i < 101; i += 1) {
        const response = await fetch(`${origin}${path}`);
        expect(response.status).not.toBe(429);
      }
    }
  });

  it('returns 429 for a non-exempt /api/* route after 100 requests', async () => {
    const origin = await startApp();
    let lastStatus = 0;
    for (let i = 0; i < 101; i += 1) {
      const response = await fetch(`${origin}/api/probe`);
      lastStatus = response.status;
    }
    expect(lastStatus).toBe(429);
  });
});
