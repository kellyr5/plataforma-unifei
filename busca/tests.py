"""
Testes da busca do forum.

Cobrem o caminho textual e o recorte de acesso, que sao o que roda em qualquer
ambiente. O caminho semantico depende de um modelo de aprendizado de maquina de
mais de 2 GB, e baixa-lo dentro da suite de testes tornaria a execucao
inviavel; o que garantimos aqui e que a ausencia do modelo nao quebra nada e
que a busca continua respondendo.
"""

from rest_framework import status
from rest_framework.test import APITestCase

from busca import embeddings, services
from config.testing import (
    criar_curso,
    criar_disciplina,
    criar_topico,
    criar_usuario,
    matricular,
)


class BuscaTextualTests(APITestCase):
    """Correspondencia por termo, que responde sem o modelo instalado."""

    def setUp(self):
        self.curso = criar_curso()
        self.disciplina = criar_disciplina('CTCO01', 'Algoritmos', 1, self.curso)
        self.outra = criar_disciplina('CTCO02', 'Calculo I', 1, self.curso)

        self.aluno = criar_usuario('Diego Martins')
        matricular(self.aluno, self.disciplina)

        self.topico = criar_topico(
            self.aluno, self.disciplina,
            titulo='Erro de segmentacao ao liberar memoria',
            conteudo='Uso free() no fim da funcao e o programa quebra.',
        )

        self.client.force_authenticate(user=self.aluno)

    def test_encontra_pelo_titulo(self):
        resposta = self.client.get('/api/busca/', {'q': 'segmentacao'})

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data['total'], 1)
        self.assertEqual(str(self.topico.id), resposta.data['resultados'][0]['id'])

    def test_encontra_pelo_conteudo(self):
        resposta = self.client.get('/api/busca/', {'q': 'free()'})

        self.assertEqual(resposta.data['total'], 1)

    def test_consulta_vazia_nao_erra(self):
        resposta = self.client.get('/api/busca/', {'q': '   '})

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(resposta.data['modo'], 'vazia')
        self.assertEqual(resposta.data['total'], 0)

    def test_nao_devolve_publicacao_de_disciplina_nao_cursada(self):
        """
        O recorte de acesso vale na busca.

        Devolver o trecho de uma publicacao que a pessoa nao poderia abrir e
        vazamento, mesmo que o link final retornasse 403.
        """
        estranho = criar_usuario('Larissa Campos')
        matricular(estranho, self.outra)

        self.client.force_authenticate(user=estranho)
        resposta = self.client.get('/api/busca/', {'q': 'segmentacao'})

        self.assertEqual(resposta.data['total'], 0)

    def test_filtra_por_disciplina(self):
        matricular(self.aluno, self.outra)
        criar_topico(
            self.aluno, self.outra,
            titulo='Duvida sobre limites e segmentacao do dominio',
            conteudo='Como identificar o intervalo?',
        )

        resposta = self.client.get('/api/busca/', {
            'q': 'segmentacao', 'disciplina': str(self.outra.id),
        })

        self.assertEqual(resposta.data['total'], 1)
        self.assertEqual(
            'CTCO02', resposta.data['resultados'][0]['disciplina_codigo'],
        )

    def test_exige_autenticacao(self):
        self.client.force_authenticate(user=None)
        resposta = self.client.get('/api/busca/', {'q': 'segmentacao'})

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)


class IndexacaoSemModeloTests(APITestCase):
    """
    A ausencia da biblioteca de embeddings nao pode quebrar o forum.

    E o cenario padrao da suite: o ambiente de teste nao instala o modelo, e
    tudo precisa continuar funcionando com a busca caindo para o modo textual.
    """

    def setUp(self):
        self.curso = criar_curso()
        self.disciplina = criar_disciplina('CTCO01', 'Algoritmos', 1, self.curso)
        self.aluno = criar_usuario('Diego Martins')
        matricular(self.aluno, self.disciplina)

    def test_indexar_sem_biblioteca_devolve_none(self):
        topico = criar_topico(self.aluno, self.disciplina, titulo='Teste')

        if embeddings.disponivel():
            self.skipTest('Ambiente tem o modelo instalado; caso nao se aplica.')

        self.assertIsNone(services.indexar_post(topico))

    def test_busca_semantica_sem_biblioteca_devolve_none(self):
        if embeddings.disponivel():
            self.skipTest('Ambiente tem o modelo instalado; caso nao se aplica.')

        self.assertIsNone(services.buscar_semantica(self.aluno, 'qualquer coisa'))

    def test_texto_do_post_usa_o_titulo_do_topico_na_resposta(self):
        """
        A resposta herda o assunto do topico.

        Sem isso, "sim, e isso mesmo" viraria um vetor sem relacao com o
        assunto, e apareceria como resultado de buscas aleatorias.
        """
        topico = criar_topico(
            self.aluno, self.disciplina,
            titulo='Complexidade de lacos aninhados',
            conteudo='O laco interno depende do tamanho da entrada?',
        )

        from forum.models import Post

        resposta = Post.objects.create(
            disciplina=self.disciplina,
            autor=self.aluno,
            post_pai=topico,
            conteudo='Nao, ele percorre sempre 26 posicoes.',
        )

        texto = services.texto_do_post(resposta)

        self.assertIn('Complexidade de lacos aninhados', texto)
        self.assertIn('26 posicoes', texto)
