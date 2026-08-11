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
    vincular,
)
from forum.models import Post, Voto


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

        ids = [item['id'] for item in resposta.data]
        self.assertNotIn(str(self.topico.id), ids)
