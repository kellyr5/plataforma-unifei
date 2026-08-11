"""
Testes das notificações, cobrindo o REST e o canal WebSocket.

Os testes de WebSocket usam a camada de canais em memória, porque exigir um
Redis rodando quebraria a suíte em qualquer máquina que não o tivesse. O
comportamento verificado é o mesmo: a mensagem sai do serviço, passa pelo
grupo do destinatário e chega ao consumer.
"""

from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.test import TransactionTestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from config.asgi import application
from config.testing import criar_usuario, itens
from notificacoes.models import Notificacao
from notificacoes.services import contar_nao_lidas, criar_notificacao


# Substitui o Redis pela camada em memória durante os testes.
CAMADA_EM_MEMORIA = {
    'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'},
}


def criar_notificacao_simples(destinatario, titulo='Nova resposta'):
    """Atalho para os testes que só precisam de um registro qualquer."""
    return Notificacao.objects.create(
        destinatario=destinatario,
        tipo='nova_resposta',
        titulo=titulo,
        mensagem='Alguém respondeu ao seu tópico.',
    )


class ServicoNotificacaoTests(APITestCase):
    """Regras do serviço, independentes da camada de transporte."""

    def setUp(self):
        self.destinatario = criar_usuario(nome='Destinatário')
        self.remetente = criar_usuario(nome='Remetente')

    @override_settings(CHANNEL_LAYERS=CAMADA_EM_MEMORIA)
    def test_criar_notificacao_persiste_no_banco(self):
        notificacao = criar_notificacao(
            destinatario=self.destinatario,
            tipo='nova_resposta',
            titulo='Nova resposta',
            mensagem='Alguém respondeu ao seu tópico.',
            remetente=self.remetente,
        )

        self.assertIsNotNone(notificacao)
        self.assertEqual(Notificacao.objects.count(), 1)

    @override_settings(CHANNEL_LAYERS=CAMADA_EM_MEMORIA)
    def test_usuario_nao_e_notificado_das_proprias_acoes(self):
        notificacao = criar_notificacao(
            destinatario=self.destinatario,
            tipo='voto_recebido',
            titulo='Novo voto',
            mensagem='Você votou no próprio post.',
            remetente=self.destinatario,
        )

        self.assertIsNone(notificacao)
        self.assertEqual(Notificacao.objects.count(), 0)

    def test_falha_no_broadcast_nao_impede_a_persistencia(self):
        """
        Aponta a camada de canais para um Redis inexistente. O registro precisa
        sobreviver, porque a lista de notificações é lida do banco.
        """
        camada_quebrada = {
            'default': {
                'BACKEND': 'channels_redis.pubsub.RedisPubSubChannelLayer',
                'CONFIG': {'hosts': ['redis://127.0.0.1:6399/0']},
            },
        }

        with override_settings(CHANNEL_LAYERS=camada_quebrada):
            notificacao = criar_notificacao(
                destinatario=self.destinatario,
                tipo='nova_resposta',
                titulo='Nova resposta',
                mensagem='Alguém respondeu ao seu tópico.',
            )

        self.assertIsNotNone(notificacao)
        self.assertEqual(Notificacao.objects.count(), 1)

    def test_contador_considera_apenas_as_nao_lidas(self):
        criar_notificacao_simples(self.destinatario)
        lida = criar_notificacao_simples(self.destinatario)
        lida.marcar_como_lida()

        self.assertEqual(contar_nao_lidas(self.destinatario), 1)


class NotificacaoAPITests(APITestCase):
    """/api/notificacoes/"""

    def setUp(self):
        self.usuario = criar_usuario(nome='Usuário')
        self.outro = criar_usuario(nome='Outro Usuário')

    def test_usuario_ve_apenas_as_proprias_notificacoes(self):
        criar_notificacao_simples(self.usuario)
        criar_notificacao_simples(self.outro)
        self.client.force_authenticate(user=self.usuario)

        resposta = self.client.get(reverse('notificacao-list'))

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(len(itens(resposta)), 1)

    def test_listagem_exige_autenticacao(self):
        resposta = self.client.get(reverse('notificacao-list'))

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)


@override_settings(CHANNEL_LAYERS=CAMADA_EM_MEMORIA)
class NotificacaoWebSocketTests(TransactionTestCase):
    """
    ws://.../ws/notificacoes/?token=<access>

    Usa TransactionTestCase porque o consumer acessa o banco em outra thread,
    e o TestCase comum mantém tudo dentro de uma transação que essa thread não
    enxergaria.
    """

    def setUp(self):
        self.usuario = criar_usuario(nome='Usuário Conectado')
        self.token = str(RefreshToken.for_user(self.usuario).access_token)

    async def conectar(self, token):
        comunicador = WebsocketCommunicator(
            application,
            f'/ws/notificacoes/?token={token}',
        )
        conectado, _ = await comunicador.connect()
        return comunicador, conectado

    async def test_conexao_sem_token_e_recusada(self):
        comunicador = WebsocketCommunicator(application, '/ws/notificacoes/')

        conectado, _ = await comunicador.connect()

        self.assertFalse(conectado)
        await comunicador.disconnect()

    async def test_conexao_com_token_invalido_e_recusada(self):
        comunicador, conectado = await self.conectar('token-invalido')

        self.assertFalse(conectado)
        await comunicador.disconnect()

    async def test_conexao_valida_recebe_contador_inicial(self):
        comunicador, conectado = await self.conectar(self.token)

        self.assertTrue(conectado)
        mensagem = await comunicador.receive_json_from()
        self.assertEqual(mensagem['tipo'], 'conexao')
        self.assertEqual(mensagem['nao_lidas'], 0)

        await comunicador.disconnect()

    async def test_notificacao_publicada_no_grupo_chega_ao_cliente(self):
        comunicador, _ = await self.conectar(self.token)
        await comunicador.receive_json_from()  # descarta a mensagem de conexão

        camada = get_channel_layer()
        await camada.group_send(
            f'notificacoes_{self.usuario.id}',
            {
                'type': 'notificacao.nova',
                'notificacao': {
                    'id': 'teste',
                    'titulo': 'Nova resposta no seu tópico',
                },
            },
        )

        mensagem = await comunicador.receive_json_from()
        self.assertEqual(mensagem['tipo'], 'notificacao')
        self.assertEqual(
            mensagem['notificacao']['titulo'],
            'Nova resposta no seu tópico',
        )

        await comunicador.disconnect()

    async def test_acao_desconhecida_retorna_erro(self):
        comunicador, _ = await self.conectar(self.token)
        await comunicador.receive_json_from()

        await comunicador.send_json_to({'acao': 'fazer_cafe'})

        mensagem = await comunicador.receive_json_from()
        self.assertEqual(mensagem['tipo'], 'erro')

        await comunicador.disconnect()
