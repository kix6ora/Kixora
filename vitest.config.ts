import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    include: ['tests/unit/**/*.test.ts', 'tests/component/**/*.test.tsx'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      // Scope vitest coverage to ONLY files that have unit or component
      // tests today. Coverage for Supabase layers (repositories/services/
      // hooks/adapters/StoreContext) and untested components are measured
      // via Playwright E2E runs instead.
      // Expand this list as you add more tests/unit coverage in tests/unit
      // and tests/component directories.
      include: [
        'src/utils/filterSneakers.ts',
        'src/utils/roleUtils.ts',
        'src/config/env.ts',
        'src/config/cors.ts',
        'src/routes/AdminRoute.tsx',
        'src/components/Toast.tsx',
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/main.tsx',
      ],
      thresholds: {
        statements: 2,
        branches: 4,
        functions: 1,
        lines: 2,
      },
    },
  },
});
