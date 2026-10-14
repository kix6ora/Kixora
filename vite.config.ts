import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertLiveDataFlags } from './scripts/flags';

function kixoraServiceWorkerBuildId(): Plugin {
  return {
    name: 'kixora-service-worker-build-id',
    closeBundle() {
      const buildId = process.env.RENDER_GIT_COMMIT || 'local';
      const swPath = path.resolve(process.cwd(), 'dist/sw.js');
      const contents = readFileSync(swPath, 'utf8');
      const replaced = contents.replaceAll('__KIXORA_BUILD_ID__', buildId);
      writeFileSync(swPath, replaced);
      const after = readFileSync(swPath, 'utf8');
      if (after.includes('__KIXORA_BUILD_ID__')) {
        throw new Error('Service worker build id placeholder was not replaced in dist/sw.js.');
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  // Gate the production bundle on live data before anything is built. loadEnv is
  // limited to the prefixes the guard understands so only relevant keys are read.
  const env = loadEnv(mode, process.cwd(), ['VITE_', 'ALLOW_MOCK_PRODUCTION_BUILD', 'CI']);
  assertLiveDataFlags(env, mode);

return {
  plugins: [react(), kixoraServiceWorkerBuildId()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('/src/components/admin/') ||
            id.includes('/src/services/admin/') ||
            id.includes('/src/repositories/admin/')
          ) {
            return 'admin-hub';
          }
          if (id.includes('node_modules')) {
            if (id.includes('/three/') || id.includes('@react-three/')) {
              return 'three-vendor';
            }
            if (id.includes('lucide-react') || id.includes('motion')) {
              return 'ui-vendor';
            }
            if (id.includes('@supabase')) {
              return 'supabase-vendor';
            }
          }
        },
      },
    },
  },
};
});
