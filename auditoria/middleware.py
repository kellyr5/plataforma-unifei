"""
Middleware de auditoria.

Captura IP e User-Agent de cada requisicao e os armazena em uma
thread local, permitindo que signals (que rodam fora do contexto
de view) acessem essas informacoes de forma segura.

Boas praticas aplicadas:
- threading.local() garante isolamento entre requisicoes concorrentes
- Suporte a X-Forwarded-For para deploys atras de proxy/load balancer
"""

import threading


_thread_local = threading.local()


def get_request_contexto():
    """Retorna o contexto da requisicao atual (IP, User-Agent, usuario)."""
    return {
        'ip_origem': getattr(_thread_local, 'ip_origem', None),
        'user_agent': getattr(_thread_local, 'user_agent', ''),
        'usuario': getattr(_thread_local, 'usuario', None),
    }


def _capturar_ip(request):
    """
    Extrai IP do request, considerando proxies.

    Em deploys atras de nginx/load balancer, o IP real esta no header
    X-Forwarded-For (o primeiro da lista). REMOTE_ADDR sozinho daria
    apenas o IP do proxy.
    """
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


class AuditoriaContextoMiddleware:
    """Armazena IP, User-Agent e usuario da requisicao na thread atual."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        _thread_local.ip_origem = _capturar_ip(request)
        _thread_local.user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]
        _thread_local.usuario = (
            request.user if hasattr(request, 'user') and request.user.is_authenticated
            else None
        )

        try:
            response = self.get_response(request)
        finally:
            # Limpa a thread local apos cada request para evitar vazamento
            _thread_local.ip_origem = None
            _thread_local.user_agent = ''
            _thread_local.usuario = None

        return response
