"""
Rotas WebSocket do app de notificações.

Ficam separadas das rotas HTTP porque o roteamento do Channels acontece
antes do Django, no config/asgi.py.
"""

from django.urls import path

from notificacoes.consumers import NotificacaoConsumer


websocket_urlpatterns = [
    path('ws/notificacoes/', NotificacaoConsumer.as_asgi()),
]
