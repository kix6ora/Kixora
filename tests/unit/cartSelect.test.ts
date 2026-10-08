import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function readSelectStrings(source: string): string[] {
  const out: string[] = [];
  const re = /\.select\s*\(\s*`([^`]+)`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    out.push(m[1]);
  }
  return out;
}

function assertBalanced(value: string): void {
  let depth = 0;
  for (const ch of value) {
    if (ch === '(') depth += 1;
    if (ch === ')') {
      depth -= 1;
      expect(depth, `unbalanced ")" in select: ${value}`).toBeGreaterThanOrEqual(0);
    }
  }
  expect(depth, `unbalanced "(" in select: ${value}`).toBe(0);
}

describe('cartRepository getCartWithItems select', () => {
  it('has balanced parentheses, no empty embeds or stray commas, and known relations', () => {
    const repoPath = path.resolve(__dirname, '../../src/repositories/customer/cartRepository.ts');
    const source = fs.readFileSync(repoPath, 'utf8');
    const selects = readSelectStrings(source);
    expect(selects.length).toBeGreaterThan(0);

    const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
    const combined = files.map((f) => fs.readFileSync(path.join(migrationsDir, f), 'utf8')).join('\n');

    for (const sel of selects) {
      assertBalanced(sel);
      expect(sel, `empty embed in select: ${sel}`).not.toMatch(/\(\s*\)/);
      expect(sel, `stray comma in select: ${sel}`).not.toMatch(/,\s*[)]/);

      const relRe = /([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
      let rm: RegExpExecArray | null;
      while ((rm = relRe.exec(sel)) !== null) {
        const rel = rm[1];
        const tableRe = new RegExp(`create\\s+table\\s+(if\\s+not\\s+exists\\s+)?(public\\.)?${rel}\\b`, 'i');
        expect(tableRe.test(combined), `relation "${rel}" has no CREATE TABLE in supabase/migrations`).toBe(true);
      }
    }
  });
});
