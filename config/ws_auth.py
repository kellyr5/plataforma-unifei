"""
Autenticação por JWT nas conexões WebSocket.

O navegador não permite definir cabeçalhos personalizados ao abrir um
WebSocket, então o cabeçalho Authorization usado no REST não está disponível
aqui. A prática adotada é enviar o token de acesso na query string:

    ws://localhost:8000/ws/notificacoes/?token=<access_token>

Este middleware lê esse token, valida com as mesmas regras do SimpleJWT e
coloca o usuário correspondente no escopo da conexão. Se o token estiver
ausente, expirado ou inválido, o escopo recebe um usuário anônimo e cabe ao
consumer recusar a conexão.
"""

import logging
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken


logger = logging.getLogger(__name__)

Usuario = get_user_model()


@database_sync_to_async
def buscar_usuario(usuario_id):
    """Busca o usuário do token, aceitando apenas contas ativas."""
    try:
        return Usuario.objects.get(id=usuario_id, ativo=True, deleted_at__isnull=True)
    except Usuario.DoesNotExist:
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    """Resolve o usuário da conexão a partir do token na query string."""

    async def __call__(self, scope, receive, send):
        query = parse_qs(scope.get('query_string', b'').decode())
        token = query.get('token', [None])[0]

        scope['user'] = AnonymousUser()

        if not token:
            logger.warning('WebSocket recusado: token ausente na query string.')
            return await super().__call__(scope, receive, send)

        try:
            token_validado = AccessToken(token)
            usuario = await buscar_usuario(token_validado['user_id'])
        except (InvalidToken, TokenError, KeyError) as exc:
            # Token inválido ou expirado: segue como anônimo e o consumer recusa.
            logger.warning(f'WebSocket recusado: token inválido ({exc}).')
            return await super().__call__(scope, receive, send)

        if usuario.is_anonymous:
            logger.warning(
                'WebSocket recusado: usuário do token não existe, está inativo '
                'ou foi excluído.'
            )
        else:
            logger.info(f'WebSocket autenticado: {usuario.cpf}.')

        scope['user'] = usuario

        return await super().__call__(scope, receive, send)
