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

describe('orderRepository relations have backing tables', () => {
  it('every relation in getOrders select exists in supabase/migrations', () => {
    const repoPath = path.resolve(__dirname, '../../src/repositories/customer/orderRepository.ts');
    const source = fs.readFileSync(repoPath, 'utf8');
    const selects = readSelectStrings(source);
    expect(selects.length).toBeGreaterThan(0);

    const relations = new Set<string>();
    for (const sel of selects) {
      const relRe = /([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
      let rm: RegExpExecArray | null;
      while ((rm = relRe.exec(sel)) !== null) {
        relations.add(rm[1]);
      }
    }
    expect(relations.size).toBeGreaterThan(0);

    const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
    const combined = files.map((f) => fs.readFileSync(path.join(migrationsDir, f), 'utf8')).join('\n');

    for (const rel of relations) {
      const tableRe = new RegExp(`create\\s+table\\s+(if\\s+not\\s+exists\\s+)?(public\\.)?${rel}\\b`, 'i');
      expect(tableRe.test(combined), `relation "${rel}" has no CREATE TABLE in supabase/migrations`).toBe(true);
    }
  });
});
