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
from collections import defaultdict

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.utils import timezone

from colaboracao.models import Conversa, MensagemChat


def nome_do_grupo(conversa_id) -> str:
    return f'conversa_{conversa_id}'


# Quem esta com cada conversa aberta neste processo.
#
# Estrutura: {id_da_conversa: {id_do_usuario: quantidade_de_abas}}. A contagem
# por pessoa existe porque a mesma pessoa costuma abrir a conversa em mais de
# uma aba, e fechar uma delas nao deveria anuncia-la como ausente.
#
# Fica em memoria, e nao no banco: presenca e informacao efemera, que perde o
# sentido no instante em que o processo cai, e grava-la produziria escrita
# constante para um dado que ninguem consulta depois. A implantacao atual roda
# em instancia unica, entao a memoria do processo ve todas as conexoes. Com
# varias instancias, isto precisaria migrar para o Redis — e a contagem
# passaria a refletir apenas quem esta na mesma instancia, que e um erro
# discreto o bastante para passar despercebido, e por isso fica registrado.
_presenca: dict[str, dict[str, int]] = defaultdict(dict)


class ConversaConsumer(AsyncWebsocketConsumer):
    """
    Canal de uma conversa: turma, grupo de trabalho ou privada.

    Mensagens enviadas ao cliente:

        {"tipo": "conectado", "participantes": 4, "conectados": 2}
        {"tipo": "mensagem", "mensagem": {...}}
        {"tipo": "removida", "mensagem_id": "..."}
        {"tipo": "digitando", "usuario": "Diego Martins"}
        {"tipo": "presenca", "conectados": 3}
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

        self._registrar_presenca()

        await self._enviar({
            'tipo': 'conectado',
            'participantes': await self._contar_participantes(),
            'somente_leitura': self.conversa.somente_leitura,
            'conectados': self._conectados(),
        })

        # Os demais precisam saber que alguem chegou. Sem isto, a contagem so
        # se atualizaria ao recarregar a pagina.
        await self._anunciar_presenca()

    async def disconnect(self, close_code):
        if hasattr(self, 'grupo'):
            self._remover_presenca()
            await self._anunciar_presenca()
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

    async def aviso_presenca(self, event):
        await self._enviar({
            'tipo': 'presenca',
            'conectados': event['conectados'],
        })

    # ===== Presenca =====

    def _registrar_presenca(self):
        pessoas = _presenca[str(self.conversa_id)]
        chave = str(self.usuario.id)
        pessoas[chave] = pessoas.get(chave, 0) + 1

    def _remover_presenca(self):
        pessoas = _presenca.get(str(self.conversa_id))

        if not pessoas:
            return

        chave = str(self.usuario.id)
        restantes = pessoas.get(chave, 1) - 1

        if restantes > 0:
            pessoas[chave] = restantes
        else:
            pessoas.pop(chave, None)

        # Conversa sem ninguem sai do dicionario: manter a chave vazia faria a
        # estrutura crescer com o numero de conversas ja visitadas.
        if not pessoas:
            _presenca.pop(str(self.conversa_id), None)

    def _conectados(self) -> int:
        return len(_presenca.get(str(self.conversa_id), {}))

    async def _anunciar_presenca(self):
        await self.channel_layer.group_send(self.grupo, {
            'type': 'aviso.presenca',
            'conectados': self._conectados(),
        })

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
