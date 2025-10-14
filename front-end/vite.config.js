import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 3010,
    host: '0.0.0.0',
  },
  preview: {
    port: 3010,
    host: '0.0.0.0',
  },
})
