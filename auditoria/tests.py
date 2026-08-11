"""
Testes do módulo de auditoria.

O registro de auditoria tem duas exigências que se contradizem na prática: ele
precisa capturar tudo o que aconteceu, inclusive quando a ação parte de um
signal fora do contexto da view, e não pode derrubar a operação principal se
falhar. Ninguém aceita perder um post porque o log de auditoria deu erro.

Os testes cobrem essas duas garantias, mais a captura de contexto pelo
middleware, a remoção de campos sensíveis e a restrição de acesso aos
registros, que só o administrador pode consultar.
"""

from django.test import RequestFactory
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from auditoria.middleware import AuditoriaContextoMiddleware, get_request_contexto
from auditoria.models import AuditLog
from auditoria.services import registrar_acao, serializar_objeto
from config.testing import criar_disciplina, criar_usuario, itens


class MiddlewareContextoTests(APITestCase):
    """
    O middleware guarda IP, User-Agent e usuário numa thread local, para que
    signals disparados fora da view consigam alcançar esses dados.
    """

    def setUp(self):
        self.factory = RequestFactory()
        self.usuario = criar_usuario(nome='Usuário Auditado')

    def executar(self, request):
        """Passa a requisição pelo middleware e devolve o contexto capturado."""
        capturado = {}

        def proxima(req):
            capturado.update(get_request_contexto())
            return 'resposta'

        AuditoriaContextoMiddleware(proxima)(request)
        return capturado

    def test_captura_ip_e_user_agent(self):
        request = self.factory.get(
            '/api/forum/posts/',
            REMOTE_ADDR='192.168.0.10',
            HTTP_USER_AGENT='Mozilla/5.0 (teste)',
        )
        request.user = self.usuario

        contexto = self.executar(request)

        self.assertEqual(contexto['ip_origem'], '192.168.0.10')
        self.assertEqual(contexto['user_agent'], 'Mozilla/5.0 (teste)')

    def test_ip_real_vem_do_x_forwarded_for(self):
        """
        Atrás de proxy reverso, o REMOTE_ADDR seria o IP do próprio proxy, e o
        log registraria sempre o mesmo endereço para todo mundo.
        """
        request = self.factory.get(
            '/api/forum/posts/',
            REMOTE_ADDR='10.0.0.1',
            HTTP_X_FORWARDED_FOR='201.20.30.40, 10.0.0.1',
        )
        request.user = self.usuario

        contexto = self.executar(request)

        self.assertEqual(contexto['ip_origem'], '201.20.30.40')

    def test_usuario_anonimo_nao_e_registrado(self):
        from django.contrib.auth.models import AnonymousUser

        request = self.factory.get('/api/forum/posts/')
        request.user = AnonymousUser()

        contexto = self.executar(request)

        self.assertIsNone(contexto['usuario'])

    def test_contexto_e_limpo_ao_fim_da_requisicao(self):
        """Sem a limpeza, a próxima requisição da mesma thread herdaria o usuário anterior."""
        request = self.factory.get('/api/forum/posts/', REMOTE_ADDR='192.168.0.10')
        request.user = self.usuario

        self.executar(request)

        contexto = get_request_contexto()
        self.assertIsNone(contexto['usuario'])
        self.assertIsNone(contexto['ip_origem'])


class SerializacaoTests(APITestCase):
    """O que entra no log precisa ser serializável e não pode vazar segredo."""

    def test_campos_sensiveis_sao_removidos(self):
        usuario = criar_usuario(nome='Usuário Teste')

        dados = serializar_objeto(usuario)

        self.assertNotIn('password', dados)
        self.assertNotIn('last_login', dados)

    def test_codigo_de_disciplina_e_preservado(self):
        """
        O campo sensível 'codigo' pertence a CodigoAtivacao. Em Disciplina ele
        é o identificador da matéria e precisa constar no log, senão o registro
        de auditoria não diz sobre o que estava falando.
        """
        disciplina = criar_disciplina()

        dados = serializar_objeto(disciplina)

        self.assertEqual(dados['codigo'], 'XAHC01')

    def test_codigo_de_ativacao_nunca_vai_para_o_log(self):
        from datetime import timedelta

        from django.utils import timezone

        from autenticacao.models import CodigoAtivacao

        usuario = criar_usuario()
        codigo = CodigoAtivacao.objects.create(
            usuario=usuario,
            codigo='hash-do-codigo',
            tipo='ativacao',
            data_expiracao=timezone.now() + timedelta(minutes=30),
        )

        dados = serializar_objeto(codigo)

        self.assertNotIn('codigo', dados)

    def test_objeto_nulo_devolve_nulo(self):
        self.assertIsNone(serializar_objeto(None))


class RegistroDeAcaoTests(APITestCase):
    """Criação do registro em si."""

    def setUp(self):
        self.usuario = criar_usuario(nome='Moderador')
        self.disciplina = criar_disciplina()

    def test_registro_guarda_acao_e_descricao(self):
        log = registrar_acao(
            acao='disciplina_criada',
            objeto_afetado=self.disciplina,
            descricao='Disciplina cadastrada pelo administrador.',
            usuario_override=self.usuario,
        )

        self.assertIsNotNone(log)
        self.assertEqual(log.acao, 'disciplina_criada')
        self.assertEqual(log.usuario, self.usuario)
        self.assertEqual(log.objeto_id, self.disciplina.id)

    def test_registro_funciona_sem_objeto_afetado(self):
        """Ações como login não têm objeto associado."""
        log = registrar_acao(acao='login', usuario_override=self.usuario)

        self.assertIsNotNone(log)
        self.assertIsNone(log.content_type)

    def test_acao_fora_de_requisicao_nao_tem_ip(self):
        """Comandos de management e shell rodam sem contexto de requisição."""
        log = registrar_acao(acao='login', usuario_override=self.usuario)

        self.assertIsNone(log.ip_origem)

    def test_falha_no_registro_nao_propaga_erro(self):
        """
        A auditoria não pode derrubar a operação principal. Uma ação fora das
        opções válidas estoura no banco, e o serviço precisa engolir o erro e
        devolver None.
        """
        log = registrar_acao(
            acao='acao_que_nao_existe_nas_choices' * 5,
            usuario_override=self.usuario,
        )

        self.assertIsNone(log)


class ConsultaDeAuditoriaTests(APITestCase):
    """
    /api/auditoria/

    Os registros nunca são apagados. O administrador enxerga tudo; o usuário
    comum enxerga apenas o que diz respeito a ele, o que dá transparência sobre
    o próprio histórico sem expor o comportamento dos colegas.
    """

    def setUp(self):
        self.admin = criar_usuario(nome='Administrador', admin=True)
        self.aluno = criar_usuario(nome='Aluno Comum')

        # A criação de usuário já dispara auditoria por signal. Limpamos para
        # que a contagem do teste reflita apenas o que ele mesmo registrou.
        AuditLog.objects.all().delete()

        registrar_acao(acao='login', usuario_override=self.aluno)
        registrar_acao(acao='login', usuario_override=self.admin)

    def test_aluno_ve_apenas_os_proprios_registros(self):
        self.client.force_authenticate(user=self.aluno)

        resposta = self.client.get(reverse('audit-log-list'))

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        registros = itens(resposta)
        self.assertEqual(len(registros), 1)

    def test_admin_ve_todos_os_registros(self):
        self.client.force_authenticate(user=self.admin)

        resposta = self.client.get(reverse('audit-log-list'))

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(len(itens(resposta)), 2)

    def test_consulta_exige_autenticacao(self):
        resposta = self.client.get(reverse('audit-log-list'))

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_registro_nao_pode_ser_removido_pela_api(self):
        """O log é somente leitura: nem o administrador apaga um registro."""
        self.client.force_authenticate(user=self.admin)
        log = AuditLog.objects.first()

        resposta = self.client.delete(reverse('audit-log-detail', args=[log.id]))

        self.assertEqual(resposta.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertTrue(AuditLog.objects.filter(id=log.id).exists())
