import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const backendTarget = process.env.VITE_DEV_BACKEND_URL || 'http://127.0.0.1:8000'

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        host: true,
        port: 3000,
        proxy: {
            '/api': {
                target: backendTarget,
                changeOrigin: true,
            },
            '/data/history': {
                target: backendTarget,
                changeOrigin: true,
            }
        }
    }
})
