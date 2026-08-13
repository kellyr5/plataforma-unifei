"""
Testes do fórum acadêmico.

O foco está nas regras que vivem no backend e não no banco de dados, que são
justamente as que quebram sem aviso quando alguém mexe nas views: unicidade do
voto, controle de quem pode marcar a melhor resposta, restrição de uma única
melhor resposta por tópico e o soft delete dos posts.
"""

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from config.testing import (
    criar_disciplina,
    criar_resposta,
    criar_topico,
    criar_usuario,
    itens,
    matricular,
    vincular,
)
from forum.models import AlertaConteudo, PermissaoDisciplina, Post, Voto
from notificacoes.models import Notificacao


class PermissaoDisciplinaTests(APITestCase):
    """
    /api/forum/permissoes/

    O vínculo entre usuário e disciplina define quem é aluno, monitor ou
    professor, então só o administrador pode criá-lo.
    """

    def setUp(self):
        self.url = reverse('permissao-list')
        self.disciplina = criar_disciplina()
        self.aluno = criar_usuario(nome='Aluno Comum')
        self.admin = criar_usuario(nome='Administrador', admin=True)

    def test_aluno_nao_pode_listar_permissoes(self):
        self.client.force_authenticate(user=self.aluno)

        resposta = self.client.get(self.url)

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_pode_criar_vinculo(self):
        self.client.force_authenticate(user=self.admin)

        resposta = self.client.post(self.url, {
            'usuario': str(self.aluno.id),
            'disciplina': str(self.disciplina.id),
            'papel': 'monitor',
        })

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)

    def test_vinculo_existente_troca_de_papel(self):
        """
        Um usuário tem um único papel por disciplina, garantido por constraint.
        Vincular de novo troca o papel em vez de recusar: promover a monitor
        quem já é aluno da turma é o caso mais comum da coordenação.
        """
        vincular(self.aluno, self.disciplina, papel='aluno')
        self.client.force_authenticate(user=self.admin)

        resposta = self.client.post(self.url, {
            'usuario': str(self.aluno.id),
            'disciplina': str(self.disciplina.id),
            'papel': 'monitor',
        })

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(
            PermissaoDisciplina.objects.filter(
                usuario=self.aluno, disciplina=self.disciplina,
            ).count(),
            1,
        )


class DisciplinaTests(APITestCase):
    """
    /api/forum/disciplinas/

    Todo mundo consulta, porque a lista alimenta a navegação do fórum, mas a
    oferta do semestre é responsabilidade da coordenação.
    """

    def setUp(self):
        self.url = reverse('disciplina-list')
        self.aluno = criar_usuario(nome='Aluno Comum')
        self.professor = criar_usuario(nome='Professor')
        self.admin = criar_usuario(nome='Coordenação', admin=True)
        self.disciplina = criar_disciplina()

        vincular(self.professor, self.disciplina, papel='professor')

        self.payload = {
            'codigo': 'XAHC99',
            'nome': 'Compiladores',
            'curso': str(self.disciplina.curso_id),
            'periodo_sugerido': 6,
            'carga_horaria': 64,
            'semestre': '2026.2',
        }

    def test_aluno_consulta_a_lista(self):
        self.client.force_authenticate(user=self.aluno)

        resposta = self.client.get(self.url)

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)

    def test_aluno_nao_cria_disciplina(self):
        self.client.force_authenticate(user=self.aluno)

        resposta = self.client.post(self.url, self.payload)

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)

    def test_professor_nao_cria_disciplina(self):
        """Criar oferta é da coordenação, não de quem leciona."""
        self.client.force_authenticate(user=self.professor)

        resposta = self.client.post(self.url, self.payload)

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)

    def test_coordenacao_cria_disciplina(self):
        self.client.force_authenticate(user=self.admin)

        resposta = self.client.post(self.url, self.payload)

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)

    def test_aluno_nao_remove_disciplina(self):
        self.client.force_authenticate(user=self.aluno)

        resposta = self.client.delete(
            reverse('disciplina-detail', args=[self.disciplina.id])
        )

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)


class PainelDocenteTests(APITestCase):
    """
    GET /api/forum/minhas-disciplinas/

    Página inicial de quem leciona ou monitora. O recorte por papel é o que
    permite ao monitor ter uma aba própria sem trocar de conta, já que ele
    continua sendo estudante nas demais disciplinas.
    """

    def setUp(self):
        self.url = reverse('minhas-disciplinas')

        # Períodos pares: o painel do docente mostra apenas as disciplinas
        # ofertadas no semestre corrente, e agosto cai no segundo semestre.
        self.disciplina = criar_disciplina(codigo='CTCO01', periodo=2)
        self.outra = criar_disciplina(
            codigo='CRSC05', periodo=4, curso=self.disciplina.curso,
        )

        self.professor = criar_usuario(nome='Professor')
        self.monitor = criar_usuario(nome='Monitor')
        self.aluno = criar_usuario(nome='Aluno')

        vincular(self.professor, self.disciplina, papel='professor')
        vincular(self.monitor, self.disciplina, papel='monitor')
        vincular(self.monitor, self.outra, papel='aluno')
        vincular(self.aluno, self.disciplina, papel='aluno')

    def codigos(self, params=None):
        resposta = self.client.get(self.url, params or {})
        return [item['codigo'] for item in resposta.data['disciplinas']]

    def test_professor_ve_as_disciplinas_que_leciona(self):
        self.client.force_authenticate(user=self.professor)

        self.assertEqual(self.codigos(), ['CTCO01'])

    def test_aluno_sem_papel_docente_nao_ve_nada(self):
        self.client.force_authenticate(user=self.aluno)

        self.assertEqual(self.codigos(), [])

    def test_monitor_ve_apenas_onde_monitora(self):
        """Na outra disciplina ele é aluno, e ali não exerce monitoria."""
        self.client.force_authenticate(user=self.monitor)

        self.assertEqual(self.codigos({'papel': 'monitor'}), ['CTCO01'])

    def test_duvida_sem_resposta_e_contabilizada(self):
        criar_topico(self.aluno, self.disciplina)
        self.client.force_authenticate(user=self.professor)

        resposta = self.client.get(self.url)

        linha = resposta.data['disciplinas'][0]
        self.assertEqual(linha['total_topicos'], 1)
        self.assertEqual(linha['sem_resposta'], 1)

    def test_topico_respondido_sai_da_contagem_de_pendentes(self):
        topico = criar_topico(self.aluno, self.disciplina)
        criar_resposta(self.professor, topico)
        self.client.force_authenticate(user=self.professor)

        linha = self.client.get(self.url).data['disciplinas'][0]

        self.assertEqual(linha['sem_resposta'], 0)
        self.assertEqual(linha['respondi'], 1)

    def test_disciplina_com_pendencia_aparece_primeiro(self):
        vincular(self.professor, self.outra, papel='professor')
        criar_topico(self.aluno, self.outra)
        self.client.force_authenticate(user=self.professor)

        self.assertEqual(self.codigos()[0], 'CRSC05')


class PainelCoordenacaoTests(APITestCase):
    """
    GET /api/forum/painel-coordenacao/

    A regra de oferta é a que mais silenciosamente quebraria: períodos ímpares
    no primeiro semestre, pares no segundo. Sem teste, uma mudança no filtro
    faria o painel mostrar o curso inteiro sendo ofertado ao mesmo tempo, e
    isso passa despercebido porque a tela continua funcionando.
    """

    def setUp(self):
        self.url = reverse('painel-coordenacao')
        self.admin = criar_usuario(nome='Coordenação', admin=True)
        self.aluno = criar_usuario(nome='Aluno Comum')

        self.primeiro = criar_disciplina(
            codigo='XDES01', nome='Fundamentos de Programação', periodo=1,
        )
        self.terceiro = criar_disciplina(
            codigo='CMAC03', nome='Algoritmos em Grafos', periodo=3,
            curso=self.primeiro.curso,
        )
        self.quarto = criar_disciplina(
            codigo='CRSC05', nome='Sistemas Embarcados', periodo=4,
            curso=self.primeiro.curso,
        )

    def codigos(self, semestre):
        resposta = self.client.get(self.url, {'semestre': semestre})
        return [linha['codigo'] for linha in resposta.data['disciplinas']]

    def test_aluno_nao_acessa_o_painel(self):
        self.client.force_authenticate(user=self.aluno)

        resposta = self.client.get(self.url)

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)

    def test_primeiro_semestre_traz_apenas_periodos_impares(self):
        self.client.force_authenticate(user=self.admin)

        codigos = self.codigos('2026.1')

        self.assertIn('XDES01', codigos)
        self.assertIn('CMAC03', codigos)
        self.assertNotIn('CRSC05', codigos)

    def test_segundo_semestre_traz_apenas_periodos_pares(self):
        self.client.force_authenticate(user=self.admin)

        codigos = self.codigos('2026.2')

        self.assertIn('CRSC05', codigos)
        self.assertNotIn('XDES01', codigos)
        self.assertNotIn('CMAC03', codigos)

    def test_optativa_nao_entra_no_painel(self):
        criar_disciplina(
            codigo='OPT02', nome='Optativa 2', periodo=2,
            curso=self.primeiro.curso,
        )
        from forum.models import Disciplina
        Disciplina.objects.filter(codigo='OPT02').update(optativa=True)

        self.client.force_authenticate(user=self.admin)

        self.assertNotIn('OPT02', self.codigos('2026.2'))

    def test_disciplina_sem_professor_aparece_primeiro(self):
        vincular(criar_usuario(nome='Professor'), self.quarto, papel='professor')
        criar_disciplina(
            codigo='CTCO01', nome='Algoritmos e Estrutura de Dados I', periodo=2,
            curso=self.primeiro.curso,
        )
        self.client.force_authenticate(user=self.admin)

        codigos = self.codigos('2026.2')

        self.assertEqual(codigos[0], 'CTCO01')

    def test_semestres_disponiveis_comecam_em_2025(self):
        self.client.force_authenticate(user=self.admin)

        resposta = self.client.get(self.url)

        semestres = resposta.data['semestres_disponiveis']
        self.assertIn('2025.1', semestres)
        self.assertEqual(len(semestres), len(set(semestres)))


class AutoriaDePostTests(APITestCase):
    """
    Quem mexe no conteúdo.

    Antes desta verificação, qualquer pessoa autenticada conseguia editar ou
    apagar o post de outra, porque as views só checavam autenticação.
    """

    def setUp(self):
        self.disciplina = criar_disciplina()
        self.autor = criar_usuario(nome='Autor do Post')
        self.intruso = criar_usuario(nome='Outro Aluno')
        matricular(self.intruso, self.disciplina)
        self.professor = criar_usuario(nome='Professor da Disciplina')
        vincular(self.professor, self.disciplina, papel='professor')

        self.topico = criar_topico(self.autor, self.disciplina)
        self.url = reverse('post-detail', args=[self.topico.id])

    def test_autor_edita_o_proprio_post(self):
        """
        A edição parcial precisa funcionar sem reenviar o título, que é o modo
        como a tela envia a alteração de conteúdo.
        """
        self.client.force_authenticate(user=self.autor)

        resposta = self.client.patch(self.url, {'conteudo': 'Texto revisado.'})

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.topico.refresh_from_db()
        self.assertEqual(self.topico.conteudo, 'Texto revisado.')
        self.assertEqual(self.topico.titulo, 'Dúvida sobre complexidade')

    def test_edicao_registra_o_historico(self):
        from forum.models import HistoricoEdicao

        self.client.force_authenticate(user=self.autor)
        conteudo_original = self.topico.conteudo

        self.client.patch(self.url, {'conteudo': 'Texto revisado.'})

        historico = HistoricoEdicao.objects.filter(post=self.topico).first()
        self.assertIsNotNone(historico)
        self.assertEqual(historico.conteudo_anterior, conteudo_original)

    def test_outro_aluno_nao_edita_post_alheio(self):
        self.client.force_authenticate(user=self.intruso)

        resposta = self.client.patch(self.url, {'conteudo': 'Texto adulterado.'})

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
        self.topico.refresh_from_db()
        self.assertNotEqual(self.topico.conteudo, 'Texto adulterado.')

    def test_professor_nao_edita_post_alheio(self):
        """Moderar é remover conteúdo impróprio, não reescrever o que o aluno disse."""
        self.client.force_authenticate(user=self.professor)

        resposta = self.client.patch(self.url, {'conteudo': 'Texto alterado.'})

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)

    def test_outro_aluno_nao_remove_post_alheio(self):
        self.client.force_authenticate(user=self.intruso)

        resposta = self.client.delete(self.url)

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
        self.topico.refresh_from_db()
        self.assertIsNone(self.topico.deleted_at)

    def test_professor_da_disciplina_remove_post(self):
        self.client.force_authenticate(user=self.professor)

        resposta = self.client.delete(self.url)

        self.assertEqual(resposta.status_code, status.HTTP_204_NO_CONTENT)
        self.topico.refresh_from_db()
        self.assertIsNotNone(self.topico.deleted_at)


class VotoTests(APITestCase):
    """
    POST e DELETE em /api/forum/posts/{id}/votar/

    O voto funciona como alternância: votar de novo remove o voto anterior,
    o que evita que o mesmo usuário infle a pontuação de um post.
    """

    def setUp(self):
        self.disciplina = criar_disciplina()
        self.autor = criar_usuario(nome='Autor do Tópico')
        self.votante = criar_usuario(nome='Colega')
        matricular(self.votante, self.disciplina)
        self.topico = criar_topico(self.autor, self.disciplina)
        self.url = reverse('post-votar', args=[self.topico.id])

    def test_voto_incrementa_pontuacao(self):
        self.client.force_authenticate(user=self.votante)

        resposta = self.client.post(self.url)

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.topico.refresh_from_db()
        self.assertEqual(self.topico.pontuacao, 1)

    def test_segundo_voto_do_mesmo_usuario_remove_o_anterior(self):
        self.client.force_authenticate(user=self.votante)
        self.client.post(self.url)

        self.client.post(self.url)

        self.topico.refresh_from_db()
        self.assertEqual(self.topico.pontuacao, 0)
        self.assertFalse(Voto.objects.filter(post=self.topico).exists())

    def test_autor_nao_pode_votar_no_proprio_post(self):
        self.client.force_authenticate(user=self.autor)

        resposta = self.client.post(self.url)

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Voto.objects.count(), 0)

    def test_remocao_sem_voto_previo_retorna_404(self):
        self.client.force_authenticate(user=self.votante)

        resposta = self.client.delete(self.url)

        self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)


class MelhorRespostaTests(APITestCase):
    """
    POST e DELETE em /api/forum/posts/{id}/marcar-melhor/

    A view checa as regras nesta ordem: primeiro se o post é mesmo uma
    resposta, depois se o usuário tem permissão no tópico e só então se ele
    não é o autor da resposta. Os testes seguem essa mesma ordem, porque uma
    regra posterior só é alcançada quando a anterior passa.
    """

    def setUp(self):
        self.disciplina = criar_disciplina()
        self.autor_topico = criar_usuario(nome='Autor do Tópico')
        self.respondente = criar_usuario(nome='Respondente')
        self.outro_respondente = criar_usuario(nome='Outro Respondente')
        # Matriculado na turma, mas sem papel de moderação: é quem o teste de
        # permissão precisa, já que sem vínculo ele nem enxergaria o tópico.
        self.estranho = criar_usuario(nome='Colega Sem Papel de Moderação')
        matricular(self.estranho, self.disciplina)

        self.topico = criar_topico(self.autor_topico, self.disciplina)
        self.resposta = criar_resposta(self.respondente, self.topico)
        self.outra_resposta = criar_resposta(self.outro_respondente, self.topico)

    def url(self, post):
        return reverse('post-marcar-melhor', args=[post.id])

    # --- quem pode marcar ---

    def test_autor_do_topico_pode_marcar(self):
        self.client.force_authenticate(user=self.autor_topico)

        resposta = self.client.post(self.url(self.resposta))

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.resposta.refresh_from_db()
        self.assertTrue(self.resposta.e_melhor)

    def test_monitor_da_disciplina_pode_marcar(self):
        monitor = criar_usuario(nome='Monitor')
        vincular(monitor, self.disciplina, papel='monitor')
        self.client.force_authenticate(user=monitor)

        resposta = self.client.post(self.url(self.resposta))

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)

    def test_colega_sem_papel_de_moderacao_nao_pode_marcar(self):
        self.client.force_authenticate(user=self.estranho)

        resposta = self.client.post(self.url(self.resposta))

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
        self.resposta.refresh_from_db()
        self.assertFalse(self.resposta.e_melhor)

    # --- o que pode ser marcado ---

    def test_nao_pode_marcar_a_propria_resposta(self):
        """
        O respondente recebe o papel de monitor para passar pela checagem de
        permissão. Sem isso a requisição pararia no 403 e a regra de autoria,
        que é a testada aqui, nunca seria alcançada.
        """
        vincular(self.respondente, self.disciplina, papel='monitor')
        self.client.force_authenticate(user=self.respondente)

        resposta = self.client.post(self.url(self.resposta))

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.resposta.refresh_from_db()
        self.assertFalse(self.resposta.e_melhor)

    def test_topico_nao_pode_ser_marcado_como_melhor(self):
        self.client.force_authenticate(user=self.autor_topico)

        resposta = self.client.post(self.url(self.topico))

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_apenas_uma_melhor_resposta_por_topico(self):
        """
        Restrição de negócio garantida pelo backend e não por constraint,
        conforme decisão registrada na modelagem do banco.
        """
        self.client.force_authenticate(user=self.autor_topico)
        self.client.post(self.url(self.resposta))

        self.client.post(self.url(self.outra_resposta))

        marcadas = Post.objects.filter(post_pai=self.topico, e_melhor=True)
        self.assertEqual(marcadas.count(), 1)
        self.assertEqual(marcadas.first().id, self.outra_resposta.id)

    def test_desmarcar_remove_a_marcacao(self):
        self.client.force_authenticate(user=self.autor_topico)
        self.client.post(self.url(self.resposta))

        resposta = self.client.delete(self.url(self.resposta))

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.resposta.refresh_from_db()
        self.assertFalse(self.resposta.e_melhor)


class ReacaoPersisteTests(APITestCase):
    """
    POST em /api/forum/posts/{id}/reagir-persiste/

    A reação substitui o downvote e só faz sentido em respostas, já que em
    tópicos a sinalização equivalente é a ausência de melhor resposta.
    """

    def setUp(self):
        self.disciplina = criar_disciplina()
        self.autor_topico = criar_usuario(nome='Autor do Tópico')
        self.respondente = criar_usuario(nome='Respondente')
        self.topico = criar_topico(self.autor_topico, self.disciplina)
        self.resposta = criar_resposta(self.respondente, self.topico)

    def test_reacao_so_e_valida_em_respostas(self):
        self.client.force_authenticate(user=self.respondente)

        resposta = self.client.post(
            reverse('post-reagir-persiste', args=[self.topico.id])
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reacao_duplicada_e_rejeitada(self):
        self.client.force_authenticate(user=self.autor_topico)
        url = reverse('post-reagir-persiste', args=[self.resposta.id])
        self.client.post(url)

        resposta = self.client.post(url)

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.resposta.refresh_from_db()
        self.assertEqual(self.resposta.total_reacoes_persiste, 1)


class ModeracaoTests(APITestCase):
    """
    /api/forum/alertas/

    A moderação é descentralizada por disciplina: quem julga o conteúdo é o
    monitor ou o professor que acompanha a matéria, e não um administrador
    global sem contexto. O fluxo passa por pendente, em análise e decisão, e
    tanto o autor do post quanto o denunciante são avisados do desfecho.
    """

    def setUp(self):
        self.disciplina = criar_disciplina()
        self.outra_disciplina = criar_disciplina(codigo='XAHC02', nome='Cálculo I')

        self.autor = criar_usuario(nome='Autor do Post')
        self.denunciante = criar_usuario(nome='Denunciante')
        self.professor = criar_usuario(nome='Professor da Disciplina')
        self.professor_alheio = criar_usuario(nome='Professor de Outra Matéria')
        self.aluno = criar_usuario(nome='Aluno Comum')
        self.admin = criar_usuario(nome='Administrador', admin=True)

        vincular(self.professor, self.disciplina, papel='professor')
        vincular(self.professor_alheio, self.outra_disciplina, papel='professor')
        vincular(self.aluno, self.disciplina, papel='aluno')

        self.topico = criar_topico(self.autor, self.disciplina)
        self.alerta = AlertaConteudo.objects.create(
            denunciante=self.denunciante,
            post=self.topico,
            motivo='Conteúdo ofensivo.',
        )

    def url(self, acao):
        return reverse(f'alerta-{acao}', args=[self.alerta.id])

    # --- acesso à fila ---

    def test_aluno_nao_acessa_a_fila_de_moderacao(self):
        self.client.force_authenticate(user=self.aluno)

        resposta = self.client.get(reverse('alerta-list'))

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)

    def test_professor_ve_as_denuncias_da_propria_disciplina(self):
        self.client.force_authenticate(user=self.professor)

        resposta = self.client.get(reverse('alerta-list'))

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(len(itens(resposta)), 1)

    def test_professor_nao_ve_denuncias_de_outra_disciplina(self):
        self.client.force_authenticate(user=self.professor_alheio)

        resposta = self.client.get(reverse('alerta-list'))

        self.assertEqual(len(itens(resposta)), 0)

    def test_admin_ve_todas_as_denuncias(self):
        self.client.force_authenticate(user=self.admin)

        resposta = self.client.get(reverse('alerta-list'))

        self.assertEqual(len(itens(resposta)), 1)

    # --- fila de trabalho ---

    def test_assumir_marca_a_denuncia_como_em_analise(self):
        self.client.force_authenticate(user=self.professor)

        resposta = self.client.post(self.url('assumir'))

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.alerta.refresh_from_db()
        self.assertEqual(self.alerta.status, 'em_analise')
        self.assertEqual(self.alerta.assumido_por, self.professor)

    def test_denuncia_ja_assumida_por_outro_retorna_conflito(self):
        self.client.force_authenticate(user=self.professor)
        self.client.post(self.url('assumir'))

        self.client.force_authenticate(user=self.admin)
        resposta = self.client.post(self.url('assumir'))

        self.assertEqual(resposta.status_code, status.HTTP_409_CONFLICT)

    def test_liberar_devolve_a_denuncia_para_a_fila(self):
        self.client.force_authenticate(user=self.professor)
        self.client.post(self.url('assumir'))

        resposta = self.client.post(self.url('liberar'))

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.alerta.refresh_from_db()
        self.assertEqual(self.alerta.status, 'pendente')
        self.assertIsNone(self.alerta.assumido_por)

    def test_apenas_quem_assumiu_pode_liberar(self):
        self.client.force_authenticate(user=self.professor)
        self.client.post(self.url('assumir'))

        self.client.force_authenticate(user=self.admin)
        resposta = self.client.post(self.url('liberar'))

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)

    # --- resolução ---

    def test_procedente_remove_o_post_por_soft_delete(self):
        self.client.force_authenticate(user=self.professor)

        resposta = self.client.post(self.url('resolver'), {
            'decisao': 'procedente',
            'resolucao': 'Conteúdo desrespeitoso com colegas.',
        })

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.topico.refresh_from_db()
        self.assertIsNotNone(self.topico.deleted_at)

    def test_improcedente_mantem_o_post(self):
        self.client.force_authenticate(user=self.professor)

        self.client.post(self.url('resolver'), {
            'decisao': 'improcedente',
            'resolucao': 'A crítica é dura, porém pertinente ao conteúdo.',
        })

        self.topico.refresh_from_db()
        self.assertIsNone(self.topico.deleted_at)

    def test_autor_e_avisado_quando_o_post_e_removido(self):
        self.client.force_authenticate(user=self.professor)

        self.client.post(self.url('resolver'), {
            'decisao': 'procedente',
            'resolucao': 'Conteúdo desrespeitoso.',
        })

        self.assertTrue(
            Notificacao.objects.filter(
                destinatario=self.autor,
                tipo='post_removido',
            ).exists()
        )

    def test_denunciante_e_avisado_nas_duas_decisoes(self):
        self.client.force_authenticate(user=self.professor)

        self.client.post(self.url('resolver'), {
            'decisao': 'improcedente',
            'resolucao': 'Não houve violação.',
        })

        self.assertTrue(
            Notificacao.objects.filter(
                destinatario=self.denunciante,
                tipo='denuncia_resolvida',
            ).exists()
        )

    def test_denuncia_resolvida_nao_pode_ser_resolvida_de_novo(self):
        self.client.force_authenticate(user=self.professor)
        dados = {'decisao': 'improcedente', 'resolucao': 'Sem violação.'}
        self.client.post(self.url('resolver'), dados)

        resposta = self.client.post(self.url('resolver'), dados)

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_resolucao_e_obrigatoria(self):
        self.client.force_authenticate(user=self.professor)

        resposta = self.client.post(self.url('resolver'), {'decisao': 'procedente'})

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_decisao_invalida_e_rejeitada(self):
        self.client.force_authenticate(user=self.professor)

        resposta = self.client.post(self.url('resolver'), {
            'decisao': 'talvez',
            'resolucao': 'Em dúvida.',
        })

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_moderador_de_outra_disciplina_nao_resolve(self):
        self.client.force_authenticate(user=self.professor_alheio)

        resposta = self.client.post(self.url('resolver'), {
            'decisao': 'procedente',
            'resolucao': 'Removendo.',
        })

        self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)

    def test_nao_resolve_caso_assumido_por_outro_moderador(self):
        self.client.force_authenticate(user=self.professor)
        self.client.post(self.url('assumir'))

        self.client.force_authenticate(user=self.admin)
        resposta = self.client.post(self.url('resolver'), {
            'decisao': 'procedente',
            'resolucao': 'Removendo.',
        })

        self.assertEqual(resposta.status_code, status.HTTP_409_CONFLICT)


class VisibilidadePorMatriculaTests(APITestCase):
    """
    O fórum é por disciplina: só vê as discussões de uma matéria quem tem
    vínculo com ela. Sem esse recorte, o aluno recebia as dúvidas do curso
    inteiro, inclusive de períodos que nem cursa.
    """

    def setUp(self):
        self.minha = criar_disciplina(codigo='XDES01', periodo=1)
        self.alheia = criar_disciplina(
            codigo='CTCO05', periodo=5, curso=self.minha.curso,
        )

        self.aluno = criar_usuario(nome='Aluno Matriculado')
        self.outro = criar_usuario(nome='Aluno de Outra Turma')
        self.admin = criar_usuario(nome='Coordenação', admin=True)

        vincular(self.aluno, self.minha, papel='aluno')
        vincular(self.outro, self.alheia, papel='aluno')

        criar_topico(self.aluno, self.minha, titulo='Dúvida na minha turma')
        criar_topico(self.outro, self.alheia, titulo='Dúvida da outra turma')

    def titulos(self):
        resposta = self.client.get(reverse('post-list'))
        return [item['titulo'] for item in itens(resposta)]

    def test_aluno_ve_apenas_as_disciplinas_em_que_esta_matriculado(self):
        self.client.force_authenticate(user=self.aluno)

        titulos = self.titulos()

        self.assertIn('Dúvida na minha turma', titulos)
        self.assertNotIn('Dúvida da outra turma', titulos)

    def test_coordenacao_ve_todas(self):
        self.client.force_authenticate(user=self.admin)

        self.assertEqual(len(self.titulos()), 2)

    def test_sem_vinculo_nao_ve_nada(self):
        sem_turma = criar_usuario(nome='Sem Vínculo')
        self.client.force_authenticate(user=sem_turma)

        self.assertEqual(self.titulos(), [])


class PromocaoAMonitorTests(APITestCase):
    """
    POST /api/forum/permissoes/

    Promover a monitor quem já é aluno da disciplina é o caso comum, e antes
    era recusado por violação da constraint de unicidade.
    """

    def setUp(self):
        self.url = reverse('permissao-list')
        self.disciplina = criar_disciplina()
        self.admin = criar_usuario(nome='Coordenação', admin=True)
        self.estudante = criar_usuario(nome='Estudante')

        vincular(self.estudante, self.disciplina, papel='aluno')
        self.client.force_authenticate(user=self.admin)

    def test_aluno_existente_e_promovido_a_monitor(self):
        from forum.models import PermissaoDisciplina

        resposta = self.client.post(self.url, {
            'usuario': str(self.estudante.id),
            'disciplina': str(self.disciplina.id),
            'papel': 'monitor',
        })

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)

        vinculos = PermissaoDisciplina.objects.filter(
            usuario=self.estudante, disciplina=self.disciplina,
        )
        self.assertEqual(vinculos.count(), 1)
        self.assertEqual(vinculos.first().papel, 'monitor')


class RestricaoDePublicacaoTests(APITestCase):
    """
    POST e DELETE em /api/forum/posts/{id}/restringir/

    A restrição é recurso pedagógico, distinto da remoção por denúncia: o post
    continua existindo e o autor continua enxergando, com o motivo, para que
    entenda o que precisa corrigir sem ser exposto à turma.
    """

    def setUp(self):
        self.disciplina = criar_disciplina()
        self.autor = criar_usuario(nome='Autor do Post')
        self.colega = criar_usuario(nome='Colega de Turma')
        self.monitor = criar_usuario(nome='Monitor')
        self.professor_alheio = criar_usuario(nome='Professor de Outra')
        matricular(self.colega, self.disciplina)

        outra = criar_disciplina(codigo='XAHC02', nome='Cálculo I')
        vincular(self.monitor, self.disciplina, papel='monitor')
        vincular(self.colega, self.disciplina, papel='aluno')
        vincular(self.professor_alheio, outra, papel='professor')

        self.topico = criar_topico(self.autor, self.disciplina)
        self.url = reverse('post-restringir', args=[self.topico.id])

    def restringir(self, motivo='Pedido de material de avaliação restrito.'):
        return self.client.post(self.url, {'motivo': motivo})

    def test_monitor_restringe_informando_motivo(self):
        self.client.force_authenticate(user=self.monitor)

        resposta = self.restringir()

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.topico.refresh_from_db()
        self.assertTrue(self.topico.restrito)
        self.assertEqual(self.topico.restrito_por, self.monitor)

    def test_motivo_e_obrigatorio(self):
        self.client.force_authenticate(user=self.monitor)

        resposta = self.client.post(self.url, {})

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.topico.refresh_from_db()
        self.assertFalse(self.topico.restrito)

    def test_aluno_nao_restringe(self):
        self.client.force_authenticate(user=self.colega)

        resposta = self.restringir()

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)

    def test_moderador_de_outra_disciplina_nao_restringe(self):
        """
        Recebe 404, e não 403: sem vínculo com a disciplina, a publicação nem
        aparece para ele. Não fica sabendo que existe.
        """
        self.client.force_authenticate(user=self.professor_alheio)

        resposta = self.restringir()

        self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)

    def test_autor_e_notificado_com_o_motivo(self):
        self.client.force_authenticate(user=self.monitor)

        self.restringir(motivo='Fora do escopo da disciplina.')

        notificacao = Notificacao.objects.filter(
            destinatario=self.autor, tipo='post_restrito',
        ).first()
        self.assertIsNotNone(notificacao)
        self.assertIn('Fora do escopo da disciplina.', notificacao.mensagem)

    # --- visibilidade ---

    def test_colega_nao_ve_a_publicacao_restrita(self):
        self.client.force_authenticate(user=self.monitor)
        self.restringir()

        self.client.force_authenticate(user=self.colega)
        resposta = self.client.get(reverse('post-list'))

        ids = [item['id'] for item in itens(resposta)]
        self.assertNotIn(str(self.topico.id), ids)

    def test_autor_continua_vendo_a_propria_publicacao(self):
        self.client.force_authenticate(user=self.monitor)
        self.restringir()

        self.client.force_authenticate(user=self.autor)
        resposta = self.client.get(reverse('post-list'))

        ids = [item['id'] for item in itens(resposta)]
        self.assertIn(str(self.topico.id), ids)

    def test_moderacao_continua_vendo(self):
        self.client.force_authenticate(user=self.monitor)
        self.restringir()

        resposta = self.client.get(reverse('post-list'))

        ids = [item['id'] for item in itens(resposta)]
        self.assertIn(str(self.topico.id), ids)

    # --- liberação ---

    def test_liberar_devolve_a_visibilidade(self):
        self.client.force_authenticate(user=self.monitor)
        self.restringir()

        resposta = self.client.delete(self.url)

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.topico.refresh_from_db()
        self.assertFalse(self.topico.restrito)
        self.assertEqual(self.topico.motivo_restricao, '')

    def test_liberar_publicacao_sem_restricao_e_rejeitado(self):
        self.client.force_authenticate(user=self.monitor)

        resposta = self.client.delete(self.url)

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)


class SoftDeleteTests(APITestCase):
    """
    O post removido sai da listagem, mas continua no banco com deleted_at
    preenchido, preservando o histórico da discussão para auditoria.
    """

    def setUp(self):
        self.disciplina = criar_disciplina()
        self.autor = criar_usuario()
        self.topico = criar_topico(self.autor, self.disciplina)

    def test_delete_marca_deleted_at_sem_apagar_registro(self):
        self.client.force_authenticate(user=self.autor)

        self.client.delete(reverse('post-detail', args=[self.topico.id]))

        self.topico.refresh_from_db()
        self.assertIsNotNone(self.topico.deleted_at)
        self.assertTrue(Post.objects.filter(id=self.topico.id).exists())

    def test_post_removido_nao_aparece_na_listagem(self):
        self.client.force_authenticate(user=self.autor)
        self.client.delete(reverse('post-detail', args=[self.topico.id]))

        resposta = self.client.get(reverse('post-list'))

        ids = [item['id'] for item in itens(resposta)]
        self.assertNotIn(str(self.topico.id), ids)
