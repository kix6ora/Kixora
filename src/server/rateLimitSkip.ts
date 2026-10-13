/**
 * Paths exempt from the general /api/ rate limiter.
 * Values are relative to the '/api/' mount point in server.ts, so the
 * Render health probes for /api/health and /api/ready never return 429.
 */
export function isRateLimitExempt(path: string): boolean {
  return path === '/health' || path === '/ready';
}
