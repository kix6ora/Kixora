import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { assertLiveDataFlags } from './scripts/flags';

export default defineConfig(({ mode }) => {
  // Gate the production bundle on live data before anything is built. loadEnv is
  // limited to the prefixes the guard understands so only relevant keys are read.
  const env = loadEnv(mode, process.cwd(), ['VITE_', 'ALLOW_MOCK_PRODUCTION_BUILD', 'CI']);
  assertLiveDataFlags(env, mode);

return {
  plugins: [react()],
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
