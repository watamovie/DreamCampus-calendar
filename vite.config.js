import { defineConfig } from 'vite'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        howto: resolve(__dirname, 'howto.html')
      }
    }
  },
  server: {
    open: true,
    host: true // モバイル実機検証用
  }
})