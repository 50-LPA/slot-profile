import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    react({
      // Exclude PDF worker & document JSX files so Vite does not inject DOM-dependent @react-refresh into the worker
      exclude: [/\/pdf\//, /\/node_modules\//],
    }),
    tailwindcss(),
  ],
  worker: { format: 'es' },
})

