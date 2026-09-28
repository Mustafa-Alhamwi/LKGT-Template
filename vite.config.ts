import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// عزل المصدر (COOP/COEP) يسمح لنموذج التفريغ بالعمل بعدة خيوط = أسرع
const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
}

export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173, host: true, open: false, headers: isolation },
  preview: { port: 4173, host: true, open: false, headers: isolation },
  worker: { format: 'es' },
  // وحدات تُحمَّل عند أول استخدام — نجهّزها مسبقاً لتفادي إعادة تحميل الصفحة أثناء العمل في وضع التطوير
  optimizeDeps: { include: ['@anthropic-ai/sdk', 'mp4-muxer', 'ag-psd', 'gifenc', 'fflate', 'qrcode-generator', 'html-to-image'] },
  build: { chunkSizeWarningLimit: 1500 },
})
