import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  base: '/ETQ/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        calculator: resolve(__dirname, 'calculator.html'),
        onboarding: resolve(__dirname, 'onboarding.html'),
        disclaimer: resolve(__dirname, 'disclaimer.html')
      }
    }
  }
})
