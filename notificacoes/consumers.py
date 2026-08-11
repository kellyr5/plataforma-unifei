"""
Consumer WebSocket das notificações.

Cada usuário autenticado entra em um grupo próprio, identificado pelo seu
UUID. Quando o serviço de notificações cria um registro, ele publica no grupo
do destinatário e a mensagem chega ao navegador sem que o frontend precise
ficar consultando a API de tempos em tempos.

Mensagens enviadas ao cliente:

    {"tipo": "conexao", "nao_lidas": 3}
    {"tipo": "notificacao", "notificacao": {...}}
    {"tipo": "nao_lidas", "total": 4}

Mensagens aceitas do cliente:

    {"acao": "marcar_lida", "notificacao_id": "<uuid>"}
    {"acao": "contar_nao_lidas"}
"""

import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from notificacoes.models import Notificacao
from notificacoes.services import contar_nao_lidas


def nome_do_grupo(usuario_id) -> str:
    """Monta o nome do grupo do usuário, usado também pelo serviço de notificações."""
    return f'notificacoes_{usuario_id}'


class NotificacaoConsumer(AsyncWebsocketConsumer):
    """Canal privado de notificações de um único usuário."""

    async def connect(self):
        usuario = self.scope.get('user')

        # Sem token válido não há canal: o WebSocket é sempre pessoal.
        if not usuario or not usuario.is_authenticated:
            await self.close(code=4001)
            return

        self.usuario = usuario
        self.grupo = nome_do_grupo(usuario.id)

        await self.channel_layer.group_add(self.grupo, self.channel_name)
        await self.accept()

        # Ao conectar, o cliente já recebe o contador para pintar o badge.
        await self.enviar_json({
            'tipo': 'conexao',
            'nao_lidas': await self._contar_nao_lidas(),
        })

    async def disconnect(self, close_code):
        # O grupo só existe se a conexão chegou a ser aceita.
        if hasattr(self, 'grupo'):
            await self.channel_layer.group_discard(self.grupo, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        try:
            dados = json.loads(text_data or '{}')
        except json.JSONDecodeError:
            await self.enviar_json({'tipo': 'erro', 'detalhe': 'JSON inválido.'})
            return

        acao = dados.get('acao')

        if acao == 'marcar_lida':
            await self._marcar_como_lida(dados.get('notificacao_id'))
            await self.enviar_json({
                'tipo': 'nao_lidas',
                'total': await self._contar_nao_lidas(),
            })

        elif acao == 'contar_nao_lidas':
            await self.enviar_json({
                'tipo': 'nao_lidas',
                'total': await self._contar_nao_lidas(),
            })

        else:
            await self.enviar_json({'tipo': 'erro', 'detalhe': 'Ação desconhecida.'})

    # ===== Eventos recebidos do grupo =====

    async def notificacao_nova(self, event):
        """
        Recebe o evento publicado pelo serviço de notificações.

        O nome do método corresponde ao type 'notificacao.nova' enviado no
        group_send, com o ponto convertido em sublinhado pelo Channels.
        """
        await self.enviar_json({
            'tipo': 'notificacao',
            'notificacao': event['notificacao'],
            'nao_lidas': await self._contar_nao_lidas(),
        })

    # ===== Auxiliares =====

    async def enviar_json(self, conteudo: dict):
        await self.send(text_data=json.dumps(conteudo, ensure_ascii=False))

    @database_sync_to_async
    def _contar_nao_lidas(self) -> int:
        return contar_nao_lidas(self.usuario)

    @database_sync_to_async
    def _marcar_como_lida(self, notificacao_id) -> None:
        """Marca como lida apenas se a notificação pertencer ao usuário conectado."""
        if not notificacao_id:
            return

        notificacao = Notificacao.objects.filter(
            id=notificacao_id,
            destinatario=self.usuario,
        ).first()

        if notificacao:
            notificacao.marcar_como_lida()
