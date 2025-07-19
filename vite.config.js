import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020'
  },
  server: {
    open: true,
    host: true // モバイル実機検証用
  }
})