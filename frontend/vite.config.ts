import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,

    // Aceita o dominio temporario do Cloudflare Tunnel, usado para expor a
    // aplicacao durante a avaliacao com usuarios. Sem esta linha o Vite recusa
    // a requisicao com "Blocked request. This host is not allowed", protecao
    // que existe para impedir que um site externo alcance o servidor de
    // desenvolvimento pelo navegador de quem programa.
    //
    // Como o proxy abaixo encaminha /api, /media e /ws pelo lado do servidor,
    // um unico tunel apontando para esta porta cobre a aplicacao inteira.
    allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.loca.lt'],

    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // Arquivos enviados e certificados gerados sao servidos pelo Django em
      // /media/. Sem este proxy, o link de download cairia no Vite.
      '/media': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // Encaminha o WebSocket das notificacoes e das conversas para o Daphne.
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
