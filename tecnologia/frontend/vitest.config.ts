import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', include: ['test/unit/**/*.test.{ts,tsx}'], setupFiles: ['test/soporte/vitest.ts'], reporters: ['default', 'junit'], outputFile: { junit: '../.local/evidencia/001/frontend-junit.xml' } },
});
