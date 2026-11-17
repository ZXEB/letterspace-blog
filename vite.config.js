import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({ plugins: [react()], server: { watch: { ignored: ['**/.cache/**', '**/dist/**'] }, proxy: { '/api': { target: process.env.BLOG_ORIGIN || 'http://localhost:18080', changeOrigin: true, ...(process.env.BLOG_LOCAL_ADDRESS ? { localAddress: process.env.BLOG_LOCAL_ADDRESS } : {}) } } } })
