"""
Configuração ASGI do projeto.

Substitui a aplicação WSGI original porque o Django sozinho não atende
WebSocket. O ProtocolTypeRouter separa os dois protocolos: requisições HTTP
seguem para o Django como sempre, e conexões WebSocket passam antes pelo
middleware de autenticação JWT e depois pelas rotas de cada app.

Em desenvolvimento o runserver já usa este arquivo, pois o Daphne está
instalado. Em produção, o servidor é iniciado apontando para config.asgi.
"""

import os

from django.core.asgi import get_asgi_application


os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# A aplicação HTTP precisa ser carregada antes dos imports que tocam models,
# caso contrário o Django reclama que os apps ainda não foram registrados.
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from channels.security.websocket import AllowedHostsOriginValidator  # noqa: E402
from django.conf import settings  # noqa: E402

from colaboracao.routing import websocket_urlpatterns as rotas_conversas  # noqa: E402
from config.ws_auth import JWTAuthMiddleware  # noqa: E402
from notificacoes.routing import websocket_urlpatterns as rotas_notificacoes  # noqa: E402


# A autenticacao por JWT ja protege o canal. O validador de origem e uma
# segunda barreira contra cross-site hijacking, importante em producao, mas
# atrapalha em desenvolvimento no WSL, onde o IP da rede muda a cada reboot e
# raramente coincide com o ALLOWED_HOSTS.
aplicacao_websocket = JWTAuthMiddleware(
    URLRouter(rotas_notificacoes + rotas_conversas)
)

if not settings.DEBUG:
    aplicacao_websocket = AllowedHostsOriginValidator(aplicacao_websocket)


application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': aplicacao_websocket,
})
