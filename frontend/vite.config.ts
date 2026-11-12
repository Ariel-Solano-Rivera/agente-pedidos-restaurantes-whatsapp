import { defineConfig } from 'vite'; import react from '@vitejs/plugin-react';
// En desarrollo (`npm run dev`) /api se reenvía al backend, igual que nginx en Docker Compose.
export default defineConfig({ plugins:[react()], server:{ proxy:{ '/api':{ target: process.env.VITE_API_PROXY ?? 'http://localhost:8080', changeOrigin:true } } } });
