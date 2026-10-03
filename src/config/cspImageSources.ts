export function buildCspImageSources(): string[] {
  return [
    "'self'",
    'data:',
    'blob:',
    'https://*.supabase.co',
    'https://res.cloudinary.com',
    'https://images.unsplash.com',
  ];
}

export function buildCspConnectSources(modelBaseUrl?: string): string[] {
  const sources = [
    "'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co',
    'https://api.cloudinary.com',
    'https://res.cloudinary.com',
    'https://www.google-analytics.com',
    'https://accounts.google.com',
  ];

  if (modelBaseUrl) {
    let modelOrigin: string;
    try {
      const parsed = new URL(modelBaseUrl);
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
        throw new Error();
      }
      modelOrigin = parsed.origin;
    } catch {
      throw new Error('VITE_SNEAKER_MODEL_BASE_URL must be a valid HTTP(S) URL without credentials.');
    }
    if (!sources.includes(modelOrigin)) sources.push(modelOrigin);
  }

  return sources;
}

export function buildCspWorkerSources(): string[] {
  return ["'self'", 'blob:'];
}
