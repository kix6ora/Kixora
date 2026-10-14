/**
 * CSRF protection: Fetch Metadata (Sec-Fetch-Site) + double-submit cookie.
 *
 * Replaces `csurf`, which is archived and unmaintained.
 * See docs/adr/0001-csrf-double-submit.md.
 *
 * Compatibility contract (do not change without updating the ADR and the
 * Playwright security specs):
 *   - cookie name: csrf_secret
 *   - header name: csrf-token
 *   - endpoints:  GET /api/csrf, GET /api/csrf-token -> { csrfToken }
 *   - rejection:  403 { error: 'Invalid CSRF token' }
 */
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, RequestHandler } from 'express';

export const CSRF_COOKIE_NAME = 'csrf_secret';
export const CSRF_HEADER_NAME = 'csrf-token';
const CSRF_TOKEN_BYTES = 32;

type Cookies = Record<string, string | undefined>;
type CookieRequest = Request & { cookies?: Cookies };

export function generateCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_BYTES).toString('base64url');
}

/** Timing-safe comparison of the cookie token and the submitted token. */
export function csrfTokensMatch(cookieToken?: string, submittedToken?: string): boolean {
  if (!cookieToken || !submittedToken) return false;
  const a = Buffer.from(cookieToken);
  const b = Buffer.from(submittedToken);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Reads the submitted token from the csrf-token header, then the `_csrf` body field. */
export function readSubmittedCsrfToken(req: CookieRequest): string | undefined {
  const header = req.headers[CSRF_HEADER_NAME];
  if (typeof header === 'string' && header.length > 0) return header;
  const body = req.body as { _csrf?: unknown } | undefined;
  if (body && typeof body._csrf === 'string' && body._csrf.length > 0) return body._csrf;
  return undefined;
}

export interface CsrfCookieOptions {
  secure: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}

/**
 * Ensures every request carries a `csrf_secret` cookie. The cookie is httpOnly:
 * the client reads the token from the /api/csrf response body and echoes it in
 * the `csrf-token` header, so JavaScript never reads the cookie.
 */
export function createCsrfCookieMiddleware(options: CsrfCookieOptions): RequestHandler {
  return (req: CookieRequest, res, next) => {
    const existing = req.cookies?.[CSRF_COOKIE_NAME];
    if (typeof existing === 'string' && existing.length > 0) {
      return next();
    }

    const token = generateCsrfToken();
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: options.sameSite ?? 'strict',
      secure: options.secure,
      path: '/',
    });

    if (req.cookies) {
      req.cookies[CSRF_COOKIE_NAME] = token;
    } else {
      req.cookies = { [CSRF_COOKIE_NAME]: token };
    }
    return next();
  };
}

/** Rejects state-changing requests whose cookie and submitted tokens disagree. */
export function createCsrfProtection(): RequestHandler {
  return (req: CookieRequest, res, next) => {
    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
    const submittedToken = readSubmittedCsrfToken(req);
    if (csrfTokensMatch(cookieToken, submittedToken)) {
      return next();
    }
    return res.status(403).json({ error: 'Invalid CSRF token' });
  };
}

export interface FetchMetadataGuardOptions {
  allowedOrigins: string[];
}

/**
 * Fetch Metadata guard. Rejects cross-site state-changing requests, and any
 * state-changing request whose Origin is present but not allowlisted. Requests
 * with neither `Sec-Fetch-Site` nor `Origin` (curl, mobile, server-to-server)
 * are allowed — CSRF is a browser-only attack and browsers always send one.
 * `/api/webhooks/*` is exempt (signature-verified server callbacks).
 */
export function createFetchMetadataGuard(options: FetchMetadataGuardOptions): RequestHandler {
  return (req, res, next) => {
    const method = req.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return next();
    }
    if (req.path.startsWith('/webhooks/')) {
      return next();
    }

    const secFetchSite = req.headers['sec-fetch-site'];
    if (typeof secFetchSite === 'string' && secFetchSite.length > 0) {
      if (secFetchSite === 'cross-site') {
        return res.status(403).json({ error: 'Blocked cross-site request' });
      }
      return next();
    }

    const origin = req.headers.origin;
    if (typeof origin === 'string' && origin.length > 0 && !options.allowedOrigins.includes(origin)) {
      return res.status(403).json({ error: 'Blocked cross-origin request' });
    }
    return next();
  };
}
