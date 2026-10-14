import { describe, expect, it, vi } from 'vitest';
import type { Request, RequestHandler, Response } from 'express';
import {
  CSRF_COOKIE_NAME,
  csrfTokensMatch,
  createCsrfCookieMiddleware,
  createCsrfProtection,
  createFetchMetadataGuard,
  generateCsrfToken,
  readSubmittedCsrfToken,
} from '../../src/server/csrf';

interface FakeResponse {
  statusCode: number;
  body: unknown;
  cookies: Array<{ name: string; value: string; options: unknown }>;
  status(code: number): FakeResponse;
  json(payload: unknown): FakeResponse;
  cookie(name: string, value: string, options: unknown): FakeResponse;
}

function makeResponse(): FakeResponse {
  const res: FakeResponse = {
    statusCode: 200,
    body: undefined,
    cookies: [],
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(payload) {
      res.body = payload;
      return res;
    },
    cookie(name, value, options) {
      res.cookies.push({ name, value, options });
      return res;
    },
  };
  return res;
}

function makeRequest(overrides: Record<string, unknown> = {}) {
  return {
    method: 'POST',
    path: '/payments/payfast/initiate',
    headers: {} as Record<string, string>,
    cookies: undefined,
    body: {},
    ...overrides,
  };
}

function run(middleware: RequestHandler, req: unknown, res: FakeResponse) {
  const next = vi.fn();
  (middleware as unknown as (r: Request, s: Response, n: () => void) => void)(
    req as Request,
    res as unknown as Response,
    next,
  );
  return next;
}

describe('csrf token helpers', () => {
  it('generates distinct, url-safe tokens', () => {
    const a = generateCsrfToken();
    const b = generateCsrfToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(20);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('compares tokens with a timing-safe equality check', () => {
    const token = generateCsrfToken();
    expect(csrfTokensMatch(token, token)).toBe(true);
    expect(csrfTokensMatch(token, generateCsrfToken())).toBe(false);
    expect(csrfTokensMatch(undefined, token)).toBe(false);
    expect(csrfTokensMatch(token, undefined)).toBe(false);
    expect(csrfTokensMatch('short', 'a-much-longer-token-value')).toBe(false);
  });

  it('reads the token from the header first, then the body', () => {
    expect(readSubmittedCsrfToken(makeRequest({ headers: { 'csrf-token': 'h' } }) as never)).toBe('h');
    expect(readSubmittedCsrfToken(makeRequest({ body: { _csrf: 'b' } }) as never)).toBe('b');
    expect(
      readSubmittedCsrfToken(makeRequest({ headers: { 'csrf-token': 'h' }, body: { _csrf: 'b' } }) as never),
    ).toBe('h');
    expect(readSubmittedCsrfToken(makeRequest() as never)).toBeUndefined();
  });
});

describe('csrf cookie middleware', () => {
  it('issues an httpOnly csrf_secret cookie when none is present', () => {
    const req = makeRequest();
    const res = makeResponse();
    const next = run(createCsrfCookieMiddleware({ secure: true }), req, res);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.cookies).toHaveLength(1);
    expect(res.cookies[0].name).toBe(CSRF_COOKIE_NAME);
    expect(res.cookies[0].options).toMatchObject({ httpOnly: true, sameSite: 'strict', secure: true });
    expect(req.cookies).toMatchObject({ [CSRF_COOKIE_NAME]: res.cookies[0].value });
  });

  it('keeps an existing cookie', () => {
    const req = makeRequest({ cookies: { [CSRF_COOKIE_NAME]: 'existing' } });
    const res = makeResponse();
    run(createCsrfCookieMiddleware({ secure: false }), req, res);
    expect(res.cookies).toHaveLength(0);
  });
});

describe('csrf protection', () => {
  it('accepts a matching cookie and header', () => {
    const token = generateCsrfToken();
    const req = makeRequest({ cookies: { [CSRF_COOKIE_NAME]: token }, headers: { 'csrf-token': token } });
    const res = makeResponse();
    expect(run(createCsrfProtection(), req, res)).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  it('rejects a missing or mismatched token with 403', () => {
    const missingRes = makeResponse();
    run(createCsrfProtection(), makeRequest(), missingRes);
    expect(missingRes.statusCode).toBe(403);
    expect(missingRes.body).toEqual({ error: 'Invalid CSRF token' });

    const mismatch = makeRequest({
      cookies: { [CSRF_COOKIE_NAME]: generateCsrfToken() },
      headers: { 'csrf-token': generateCsrfToken() },
    });
    const mismatchRes = makeResponse();
    run(createCsrfProtection(), mismatch, mismatchRes);
    expect(mismatchRes.statusCode).toBe(403);
  });
});

describe('fetch metadata guard', () => {
  const guard = () => createFetchMetadataGuard({ allowedOrigins: ['https://kixora.com'] });

  it('ignores safe methods', () => {
    const req = makeRequest({ method: 'GET', headers: { 'sec-fetch-site': 'cross-site' } });
    expect(run(guard(), req, makeResponse())).toHaveBeenCalledTimes(1);
  });

  it('rejects cross-site mutations', () => {
    const res = makeResponse();
    run(guard(), makeRequest({ headers: { 'sec-fetch-site': 'cross-site' } }), res);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Blocked cross-site request' });
  });

  it('allows same-origin, same-site and none', () => {
    for (const site of ['same-origin', 'same-site', 'none']) {
      expect(run(guard(), makeRequest({ headers: { 'sec-fetch-site': site } }), makeResponse())).toHaveBeenCalledTimes(1);
    }
  });

  it('exempts webhook callbacks', () => {
    const req = makeRequest({ path: '/webhooks/payfast', headers: { 'sec-fetch-site': 'cross-site' } });
    expect(run(guard(), req, makeResponse())).toHaveBeenCalledTimes(1);
  });

  it('rejects an unlisted Origin when no Fetch Metadata is present', () => {
    const res = makeResponse();
    run(guard(), makeRequest({ headers: { origin: 'https://evil.example.com' } }), res);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Blocked cross-origin request' });
  });

  it('allows an allowlisted Origin or no Origin', () => {
    expect(run(guard(), makeRequest({ headers: { origin: 'https://kixora.com' } }), makeResponse())).toHaveBeenCalledTimes(1);
    expect(run(guard(), makeRequest(), makeResponse())).toHaveBeenCalledTimes(1);
  });
});
