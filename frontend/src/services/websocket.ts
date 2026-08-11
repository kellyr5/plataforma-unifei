/**
 * Montagem da URL de conexão WebSocket.
 *
 * O navegador não permite enviar o cabeçalho Authorization ao abrir um
 * WebSocket, então o token de acesso vai na query string e é validado pelo
 * middleware JWT do backend.
 *
 * O protocolo acompanha o da página: ws em desenvolvimento, wss quando o site
 * estiver servido por HTTPS. O host também vem da própria página, de forma que
 * o proxy do Vite cuide do encaminhamento em desenvolvimento e nada precise
 * ser alterado ao publicar.
 */

export function montarUrlWebSocket(caminho: string, token: string): string {
  const protocolo = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const host = window.location.host

  return `${protocolo}://${host}${caminho}?token=${encodeURIComponent(token)}`
}
