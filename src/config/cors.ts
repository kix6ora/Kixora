export function parseCorsAllowlist(raw: string | undefined): string[] {
  return (raw || '').split(/[\s,]+/).filter(Boolean);
}

export function validateCorsAllowlistForProduction(
  raw: string | undefined,
): { origins: string[]; errors: string[] } {
  const origins = parseCorsAllowlist(raw);
  const errors: string[] = [];
  if (origins.length === 0 || origins.includes('*')) {
    errors.push('CORS_ALLOWED_ORIGINS must contain explicit origins in production.');
  }
  return { origins, errors };
}
