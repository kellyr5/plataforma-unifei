"""
Consumer WebSocket das conversas.

Cada conversa e um grupo no Channels, identificado pelo proprio id. Quem se
conecta precisa constar como participante: a verificacao acontece no momento
da conexao, e nao a cada mensagem, porque a composicao de um grupo nao muda
no meio de uma conversa e checar toda vez custaria uma consulta por mensagem.

Mensagens com anexo continuam indo pela API. Aqui trafega apenas texto, o que
mantem o socket leve e evita transportar arquivo em base64.
"""

import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.utils import timezone

from colaboracao.models import Conversa, MensagemChat


def nome_do_grupo(conversa_id) -> str:
    return f'conversa_{conversa_id}'


class ConversaConsumer(AsyncWebsocketConsumer):
    """
    Canal de uma conversa: turma, grupo de trabalho ou privada.

    Mensagens enviadas ao cliente:

        {"tipo": "conectado", "participantes": 4}
        {"tipo": "mensagem", "mensagem": {...}}
        {"tipo": "removida", "mensagem_id": "..."}
        {"tipo": "digitando", "usuario": "Diego Martins"}
        {"tipo": "erro", "detalhe": "..."}

    Mensagens aceitas do cliente:

        {"acao": "enviar", "conteudo": "texto"}
        {"acao": "digitando"}
        {"acao": "marcar_lida"}
    """

    async def connect(self):
        usuario = self.scope.get('user')
        self.conversa_id = self.scope['url_route']['kwargs']['conversa_id']

        if not usuario or not usuario.is_authenticated:
            await self.close(code=4001)
            return

        self.usuario = usuario
        self.conversa = await self._buscar_conversa()

        # Sem participacao nao ha canal. A conversa de grupo e privada, e nem
        # o professor da disciplina entra aqui.
        if self.conversa is None:
            await self.close(code=4003)
            return

        self.grupo = nome_do_grupo(self.conversa_id)
        await self.channel_layer.group_add(self.grupo, self.channel_name)
        await self.accept()

        await self._enviar({
            'tipo': 'conectado',
            'participantes': await self._contar_participantes(),
            'somente_leitura': self.conversa.somente_leitura,
        })

    async def disconnect(self, close_code):
        if hasattr(self, 'grupo'):
            await self.channel_layer.group_discard(self.grupo, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        try:
            dados = json.loads(text_data or '{}')
        except json.JSONDecodeError:
            await self._enviar({'tipo': 'erro', 'detalhe': 'JSON inválido.'})
            return

        acao = dados.get('acao')

        if acao == 'enviar':
            await self._enviar_mensagem(dados.get('conteudo', ''))

        elif acao == 'digitando':
            # Sinal efemero: nao vai ao banco e nao volta para quem digitou.
            await self.channel_layer.group_send(self.grupo, {
                'type': 'aviso.digitando',
                'usuario': self.usuario.nome_completo,
                'origem': self.channel_name,
            })

        elif acao == 'marcar_lida':
            await self._marcar_lida()

        else:
            await self._enviar({'tipo': 'erro', 'detalhe': 'Ação desconhecida.'})

    # ===== Eventos do grupo =====

    async def mensagem_nova(self, event):
        await self._enviar({'tipo': 'mensagem', 'mensagem': event['mensagem']})

    async def mensagem_removida(self, event):
        await self._enviar({
            'tipo': 'removida',
            'mensagem_id': event['mensagem_id'],
        })

    async def aviso_digitando(self, event):
        if event.get('origem') == self.channel_name:
            return

        await self._enviar({'tipo': 'digitando', 'usuario': event['usuario']})

    # ===== Auxiliares =====

    async def _enviar(self, conteudo: dict):
        await self.send(text_data=json.dumps(conteudo, ensure_ascii=False))

    async def _enviar_mensagem(self, conteudo: str):
        texto = (conteudo or '').strip()

        if not texto:
            await self._enviar({'tipo': 'erro', 'detalhe': 'Escreva algo antes de enviar.'})
            return

        if self.conversa.somente_leitura:
            await self._enviar({
                'tipo': 'erro',
                'detalhe': 'Esta conversa foi arquivada e não aceita novas mensagens.',
            })
            return

        mensagem = await self._gravar(texto)

        await self.channel_layer.group_send(self.grupo, {
            'type': 'mensagem.nova',
            'mensagem': mensagem,
        })

    @database_sync_to_async
    def _buscar_conversa(self):
        """Devolve a conversa apenas se a pessoa participar dela."""
        return Conversa.objects.filter(
            id=self.conversa_id,
            participantes__usuario=self.usuario,
        ).first()

    @database_sync_to_async
    def _contar_participantes(self):
        return self.conversa.participantes.count()

    @database_sync_to_async
    def _gravar(self, texto):
        mensagem = MensagemChat.objects.create(
            conversa=self.conversa,
            autor=self.usuario,
            conteudo=texto,
        )

        # Quem envia leu tudo, por definicao.
        self.conversa.participantes.filter(usuario=self.usuario).update(
            lido_ate=mensagem.created_at
        )

        # Nao transmitimos aqui: quem chamou ja publica no grupo do Channels.
        # Falta apenas avisar quem esta com a conversa fechada.
        from colaboracao.services import notificar_mensagem

        notificar_mensagem(mensagem)

        return {
            'id': str(mensagem.id),
            'autor': str(self.usuario.id),
            'autor_nome': self.usuario.nome_completo,
            'conteudo': mensagem.conteudo,
            'tipo_midia': mensagem.tipo_midia,
            'arquivo_url': None,
            'nome_original': '',
            'tem_pedido_ajuda': False,
            'created_at': mensagem.created_at.isoformat(),
        }

    @database_sync_to_async
    def _marcar_lida(self):
        self.conversa.participantes.filter(usuario=self.usuario).update(
            lido_ate=timezone.now()
        )
