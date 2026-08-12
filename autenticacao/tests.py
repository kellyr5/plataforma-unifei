"""
Testes do cadastro, da ativação de conta e da autenticação JWT.

A regra central que estes testes protegem é a de que nenhuma conta consegue
autenticar antes de validar o código enviado por email, já que o vínculo do
usuário com a universidade é verificado justamente nesse momento.
"""

from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from autenticacao.models import CodigoAtivacao, Usuario
from autenticacao.utils import criar_codigo_ativacao
from config.testing import SENHA_PADRAO, criar_usuario


# A lista de tokens invalidados vive no cache. Nos testes usamos cache em
# memória para não exigir um Redis rodando na máquina de quem executar a suíte.
CACHE_EM_MEMORIA = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'testes-autenticacao',
    },
}


class RegistroTests(APITestCase):
    """POST /api/auth/register/"""

    def setUp(self):
        self.url = reverse('register')
        self.payload = {
            'cpf': '529.982.247-25',
            'email': 'aluno.novo@unifei.edu.br',
            'nome_completo': 'Aluno Novo',
            'password': SENHA_PADRAO,
            'password_confirm': SENHA_PADRAO,
        }

    def test_registro_cria_usuario_inativo(self):
        resposta = self.client.post(self.url, self.payload)

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        usuario = Usuario.objects.get(email='aluno.novo@unifei.edu.br')
        self.assertFalse(usuario.ativo)

    def test_registro_normaliza_cpf_removendo_mascara(self):
        """O usuário pode digitar o CPF com pontos e hífen, mas o banco guarda só os dígitos."""
        self.client.post(self.url, self.payload)

        self.assertTrue(Usuario.objects.filter(cpf='52998224725').exists())

    def test_registro_gera_codigo_de_ativacao(self):
        self.client.post(self.url, self.payload)

        usuario = Usuario.objects.get(email='aluno.novo@unifei.edu.br')
        self.assertTrue(
            CodigoAtivacao.objects.filter(usuario=usuario, tipo='ativacao').exists()
        )

    def test_registro_rejeita_senhas_divergentes(self):
        payload = dict(self.payload, password_confirm='OutraSenha2026.')

        resposta = self.client.post(self.url, payload)

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Usuario.objects.filter(cpf='52998224725').exists())

    def test_registro_rejeita_cpf_duplicado(self):
        self.client.post(self.url, self.payload)

        resposta = self.client.post(self.url, self.payload)

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Usuario.objects.filter(cpf='52998224725').count(), 1)


class AtivacaoTests(APITestCase):
    """POST /api/auth/ativar/"""

    def setUp(self):
        self.url = reverse('ativar')
        self.usuario = criar_usuario(nome='Aluno Inativo', ativo=False)
        self.codigo, _ = criar_codigo_ativacao(self.usuario, tipo='ativacao')

    def test_codigo_valido_ativa_conta_e_retorna_tokens(self):
        """Ao ativar, o usuário já entra na plataforma sem precisar fazer login."""
        resposta = self.client.post(
            self.url,
            {'email': self.usuario.email, 'codigo': self.codigo},
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertIn('access', resposta.data)
        self.assertIn('refresh', resposta.data)
        self.usuario.refresh_from_db()
        self.assertTrue(self.usuario.ativo)

    def test_codigo_invalido_nao_ativa_conta(self):
        resposta = self.client.post(
            self.url,
            {'email': self.usuario.email, 'codigo': '000000'},
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.usuario.refresh_from_db()
        self.assertFalse(self.usuario.ativo)

    def test_codigo_nao_pode_ser_reutilizado(self):
        self.client.post(self.url, {'email': self.usuario.email, 'codigo': self.codigo})

        resposta = self.client.post(
            self.url,
            {'email': self.usuario.email, 'codigo': self.codigo},
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_email_inexistente_retorna_mensagem_generica(self):
        """
        A resposta é a mesma de código inválido, para que não seja possível
        descobrir quais emails estão cadastrados testando um por um.
        """
        resposta = self.client.post(
            self.url,
            {'email': 'nao.existe@unifei.edu.br', 'codigo': '123456'},
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resposta.data['detail'], 'Email ou codigo invalido.')


class ReenvioCodigoTests(APITestCase):
    """POST /api/auth/reenviar-codigo/"""

    def setUp(self):
        self.url = reverse('reenviar_codigo')

    def test_email_inexistente_responde_como_sucesso(self):
        """Mesma proteção contra enumeração de emails aplicada na ativação."""
        resposta = self.client.post(self.url, {'email': 'ninguem@unifei.edu.br'})

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)

    def test_usuario_inativo_recebe_novo_codigo(self):
        usuario = criar_usuario(ativo=False)

        self.client.post(self.url, {'email': usuario.email})

        self.assertTrue(CodigoAtivacao.objects.filter(usuario=usuario).exists())


class LoginTests(APITestCase):
    """POST /api/auth/login/ e GET /api/auth/me/"""

    def setUp(self):
        self.url_login = reverse('token_obtain_pair')

    def test_conta_inativa_nao_autentica(self):
        usuario = criar_usuario(ativo=False)

        resposta = self.client.post(
            self.url_login,
            {'cpf': usuario.cpf, 'password': SENHA_PADRAO},
        )

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_conta_ativa_recebe_par_de_tokens(self):
        usuario = criar_usuario(ativo=True)

        resposta = self.client.post(
            self.url_login,
            {'cpf': usuario.cpf, 'password': SENHA_PADRAO},
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertIn('access', resposta.data)
        self.assertIn('refresh', resposta.data)

    def test_me_exige_autenticacao(self):
        resposta = self.client.get(reverse('me'))

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_retorna_dados_do_usuario_autenticado(self):
        usuario = criar_usuario(nome='Kelly Reis')
        self.client.force_authenticate(user=usuario)

        resposta = self.client.get(reverse('me'))

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data['nome_completo'], 'Kelly Reis')
        self.assertEqual(resposta.data['cpf'], usuario.cpf)


class PapeisDoUsuarioTests(APITestCase):
    """
    GET /api/auth/me/

    A resposta traz os papéis do usuário para que a interface saiba o que
    exibir. É apresentação, não autorização: cada requisição continua sendo
    verificada no backend.
    """

    def setUp(self):
        from config.testing import criar_disciplina, vincular

        self.url = reverse('me')
        self.disciplina = criar_disciplina()
        self.outra = criar_disciplina(codigo='XAHC02', nome='Cálculo I')
        self.vincular = vincular

    def test_aluno_comum_nao_pode_moderar(self):
        aluno = criar_usuario(nome='Aluno Comum')
        self.vincular(aluno, self.disciplina, papel='aluno')
        self.client.force_authenticate(user=aluno)

        resposta = self.client.get(self.url)

        self.assertFalse(resposta.data['pode_moderar'])
        self.assertFalse(resposta.data['e_monitor'])
        self.assertFalse(resposta.data['e_coordenacao'])

    def test_monitor_e_reconhecido_como_moderador(self):
        monitor = criar_usuario(nome='Monitor')
        self.vincular(monitor, self.disciplina, papel='monitor')
        self.client.force_authenticate(user=monitor)

        resposta = self.client.get(self.url)

        self.assertTrue(resposta.data['e_monitor'])
        self.assertTrue(resposta.data['pode_moderar'])

    def test_monitor_tambem_e_aluno_em_outras_disciplinas(self):
        """
        O monitor não deixa de ser estudante, então acumula papéis diferentes
        conforme a disciplina.
        """
        monitor = criar_usuario(nome='Monitor')
        self.vincular(monitor, self.disciplina, papel='monitor')
        self.vincular(monitor, self.outra, papel='aluno')
        self.client.force_authenticate(user=monitor)

        resposta = self.client.get(self.url)

        papeis = {
            item['disciplina_codigo']: item['papel']
            for item in resposta.data['papeis_disciplina']
        }
        self.assertEqual(papeis['XAHC01'], 'monitor')
        self.assertEqual(papeis['XAHC02'], 'aluno')

    def test_coordenacao_e_reconhecida(self):
        admin = criar_usuario(nome='Coordenação', admin=True)
        self.client.force_authenticate(user=admin)

        resposta = self.client.get(self.url)

        self.assertTrue(resposta.data['e_coordenacao'])
        self.assertTrue(resposta.data['pode_moderar'])

    def test_organizacao_e_reconhecida(self):
        ong = criar_usuario(nome='ONG Parceira', ong=True)
        self.client.force_authenticate(user=ong)

        resposta = self.client.get(self.url)

        self.assertTrue(resposta.data['e_organizacao'])
        self.assertFalse(resposta.data['pode_moderar'])


@override_settings(CACHES=CACHE_EM_MEMORIA)
class RotacaoDeTokenTests(APITestCase):
    """
    POST /api/auth/refresh/ e /api/auth/logout/

    A cada renovação o refresh token é trocado por um novo, e o antigo entra na
    lista de invalidados guardada no Redis. Sem isso, um token interceptado
    continuaria valendo em paralelo até expirar.
    """

    def setUp(self):
        from django.core.cache import cache
        cache.clear()

        self.usuario = criar_usuario(nome='Usuário com Sessão')
        self.refresh = str(RefreshToken.for_user(self.usuario))
        self.url_refresh = reverse('token_refresh')
        self.url_logout = reverse('logout')

    def test_renovacao_devolve_acesso_e_refresh_novos(self):
        resposta = self.client.post(self.url_refresh, {'refresh': self.refresh})

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertIn('access', resposta.data)
        self.assertIn('refresh', resposta.data)
        self.assertNotEqual(resposta.data['refresh'], self.refresh)

    def test_refresh_antigo_nao_pode_ser_reutilizado(self):
        self.client.post(self.url_refresh, {'refresh': self.refresh})

        resposta = self.client.post(self.url_refresh, {'refresh': self.refresh})

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_novo_continua_valido(self):
        primeira = self.client.post(self.url_refresh, {'refresh': self.refresh})

        segunda = self.client.post(
            self.url_refresh,
            {'refresh': primeira.data['refresh']},
        )

        self.assertEqual(segunda.status_code, status.HTTP_200_OK)

    def test_logout_invalida_o_refresh(self):
        self.client.force_authenticate(user=self.usuario)

        resposta = self.client.post(self.url_logout, {'refresh': self.refresh})

        self.assertEqual(resposta.status_code, status.HTTP_205_RESET_CONTENT)

        self.client.force_authenticate(user=None)
        renovacao = self.client.post(self.url_refresh, {'refresh': self.refresh})
        self.assertEqual(renovacao.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_exige_autenticacao(self):
        resposta = self.client.post(self.url_logout, {'refresh': self.refresh})

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_com_token_malformado_retorna_400(self):
        self.client.force_authenticate(user=self.usuario)

        resposta = self.client.post(self.url_logout, {'refresh': 'nao-e-um-token'})

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
