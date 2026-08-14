"""Rotas WebSocket das conversas."""

from django.urls import path

from colaboracao.consumers import ConversaConsumer


websocket_urlpatterns = [
    path('ws/conversas/<uuid:conversa_id>/', ConversaConsumer.as_asgi()),
]
