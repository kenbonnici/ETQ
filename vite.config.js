import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  base: '/ETQ/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        calculator: resolve(__dirname, 'calculator.html')
      }
    }
  }
})
