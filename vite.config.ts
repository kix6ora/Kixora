import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
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
});
