import { describe, expect, it } from 'vitest';
import {
  buildCspConnectSources,
  buildCspImageSources,
  buildCspWorkerSources,
} from '../../src/config/cspImageSources';

describe('Content Security Policy image sources', () => {
  it('allows the image hosts used by the app without unrelated hosts', () => {
    const imgSrc = buildCspImageSources();

    expect(imgSrc).toContain('https://images.unsplash.com');
    expect(imgSrc).toContain('https://res.cloudinary.com');
    expect(imgSrc).toContain('data:');
    expect(imgSrc).toContain('blob:');
    expect(imgSrc).not.toContain('https://img.com');
    expect(imgSrc).not.toContain('https://v5.airtableusercontent.com');
    expect(imgSrc).not.toContain('https://*.googleusercontent.com');
    expect(imgSrc).not.toContain('https:');
    expect(imgSrc).not.toContain('*');
  });

  it('allows model fetches only from the configured model host', () => {
    const connectSrc = buildCspConnectSources('https://models.example.test/catalog/');
    expect(connectSrc).toContain('https://models.example.test');
    expect(connectSrc).not.toContain('https://other-models.example.test');
    expect(buildCspWorkerSources()).toContain('blob:');
  });

  it('rejects model URLs with non-HTTP protocols or malformed URLs', () => {
    expect(() => buildCspConnectSources('javascript:alert(1)')).toThrow(/VITE_SNEAKER_MODEL_BASE_URL/);
    expect(() => buildCspConnectSources('not-a-url')).toThrow(/VITE_SNEAKER_MODEL_BASE_URL/);
  });
});
