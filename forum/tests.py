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
    vincular,
)
from forum.models import AlertaConteudo, Post, Voto
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

    def test_vinculo_duplicado_na_mesma_disciplina_e_rejeitado(self):
        """Um usuário tem um único papel por disciplina, garantido por constraint."""
        vincular(self.aluno, self.disciplina, papel='aluno')
        self.client.force_authenticate(user=self.admin)

        resposta = self.client.post(self.url, {
            'usuario': str(self.aluno.id),
            'disciplina': str(self.disciplina.id),
            'papel': 'monitor',
        })

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)


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
        self.estranho = criar_usuario(nome='Aluno Sem Vínculo')

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

    def test_aluno_sem_vinculo_nao_pode_marcar(self):
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
