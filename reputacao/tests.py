"""
Testes do módulo de reputação.

A reputação é calculada por disciplina, e não globalmente, porque alguém pode
dominar Algoritmos e não entender nada de Cálculo. A pontuação segue o modelo
do Stack Overflow: cinco pontos por voto em tópico, dez por voto em resposta e
quinze pela resposta marcada como melhor.

Os testes cobrem três frentes: o cálculo em si, a atualização automática pelos
signals quando um voto ou uma marcação acontece, e a geração do snapshot
semestral, que precisa preservar o histórico mesmo depois que a pontuação
continuar mudando.
"""

from io import StringIO

from django.core.management import call_command
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
from forum.models import Voto
from reputacao.models import (
    PONTOS_MELHOR_RESPOSTA,
    PONTOS_VOTO_RESPOSTA,
    PONTOS_VOTO_TOPICO,
    RankingSemestral,
    UsuarioDisciplinaReputacao,
)
from reputacao.services import atualizar_reputacao, recalcular_tudo


class CalculoDeReputacaoTests(APITestCase):
    """Pontuação a partir dos eventos do fórum."""

    def setUp(self):
        self.disciplina = criar_disciplina()
        self.autor = criar_usuario(nome='Autor Participativo')
        self.colega = criar_usuario(nome='Colega')

    def test_usuario_sem_atividade_nao_pontua(self):
        reputacao = atualizar_reputacao(self.autor, self.disciplina)

        self.assertEqual(reputacao.pontos, 0)

    def test_voto_em_topico_vale_cinco_pontos(self):
        topico = criar_topico(self.autor, self.disciplina)
        Voto.objects.create(usuario=self.colega, post=topico)

        reputacao = atualizar_reputacao(self.autor, self.disciplina)

        self.assertEqual(reputacao.pontos, PONTOS_VOTO_TOPICO)

    def test_voto_em_resposta_vale_dez_pontos(self):
        topico = criar_topico(self.colega, self.disciplina)
        resposta = criar_resposta(self.autor, topico)
        Voto.objects.create(usuario=self.colega, post=resposta)

        reputacao = atualizar_reputacao(self.autor, self.disciplina)

        self.assertEqual(reputacao.pontos, PONTOS_VOTO_RESPOSTA)

    def test_melhor_resposta_vale_quinze_pontos(self):
        topico = criar_topico(self.colega, self.disciplina)
        resposta = criar_resposta(self.autor, topico)
        resposta.e_melhor = True
        resposta.save(update_fields=['e_melhor'])

        reputacao = atualizar_reputacao(self.autor, self.disciplina)

        self.assertEqual(reputacao.pontos, PONTOS_MELHOR_RESPOSTA)

    def test_pontuacao_e_a_soma_dos_eventos(self):
        topico = criar_topico(self.autor, self.disciplina)
        Voto.objects.create(usuario=self.colega, post=topico)

        outro_topico = criar_topico(self.colega, self.disciplina, titulo='Outra dúvida')
        resposta = criar_resposta(self.autor, outro_topico)
        Voto.objects.create(usuario=self.colega, post=resposta)
        resposta.e_melhor = True
        resposta.save(update_fields=['e_melhor'])

        reputacao = atualizar_reputacao(self.autor, self.disciplina)

        esperado = PONTOS_VOTO_TOPICO + PONTOS_VOTO_RESPOSTA + PONTOS_MELHOR_RESPOSTA
        self.assertEqual(reputacao.pontos, esperado)

    def test_post_removido_nao_conta_pontos(self):
        """O soft delete precisa retirar a pontuação junto com o post."""
        from django.utils import timezone

        topico = criar_topico(self.autor, self.disciplina)
        Voto.objects.create(usuario=self.colega, post=topico)
        topico.deleted_at = timezone.now()
        topico.save()

        reputacao = atualizar_reputacao(self.autor, self.disciplina)

        self.assertEqual(reputacao.pontos, 0)

    def test_reputacao_e_separada_por_disciplina(self):
        outra = criar_disciplina(codigo='XAHC02', nome='Cálculo I')
        topico = criar_topico(self.autor, self.disciplina)
        Voto.objects.create(usuario=self.colega, post=topico)

        atualizar_reputacao(self.autor, self.disciplina)
        atualizar_reputacao(self.autor, outra)

        pontos = {
            r.disciplina.codigo: r.pontos
            for r in UsuarioDisciplinaReputacao.objects.filter(usuario=self.autor)
        }
        self.assertEqual(pontos['XAHC01'], PONTOS_VOTO_TOPICO)
        self.assertEqual(pontos['XAHC02'], 0)


class AtualizacaoAutomaticaTests(APITestCase):
    """
    Os signals recalculam a reputação assim que o evento acontece, sem esperar
    pelo comando de recálculo total.
    """

    def setUp(self):
        self.disciplina = criar_disciplina()
        self.autor_topico = criar_usuario(nome='Autor do Tópico')
        self.respondente = criar_usuario(nome='Respondente')
        self.outro_respondente = criar_usuario(nome='Outro Respondente')
        self.topico = criar_topico(self.autor_topico, self.disciplina)

    def pontos_de(self, usuario):
        reputacao = UsuarioDisciplinaReputacao.objects.filter(
            usuario=usuario,
            disciplina=self.disciplina,
        ).first()
        return reputacao.pontos if reputacao else 0

    def test_voto_pela_api_atualiza_a_reputacao(self):
        votante = criar_usuario(nome='Votante')
        self.client.force_authenticate(user=votante)

        self.client.post(reverse('post-votar', args=[self.topico.id]))

        self.assertEqual(self.pontos_de(self.autor_topico), PONTOS_VOTO_TOPICO)

    def test_remocao_do_voto_devolve_a_pontuacao_a_zero(self):
        votante = criar_usuario(nome='Votante')
        self.client.force_authenticate(user=votante)
        url = reverse('post-votar', args=[self.topico.id])
        self.client.post(url)

        self.client.delete(url)

        self.assertEqual(self.pontos_de(self.autor_topico), 0)

    def test_marcar_melhor_resposta_pontua_o_respondente(self):
        resposta = criar_resposta(self.respondente, self.topico)
        self.client.force_authenticate(user=self.autor_topico)

        self.client.post(reverse('post-marcar-melhor', args=[resposta.id]))

        self.assertEqual(self.pontos_de(self.respondente), PONTOS_MELHOR_RESPOSTA)

    def test_desmarcar_melhor_resposta_retira_os_pontos(self):
        resposta = criar_resposta(self.respondente, self.topico)
        self.client.force_authenticate(user=self.autor_topico)
        url = reverse('post-marcar-melhor', args=[resposta.id])
        self.client.post(url)

        self.client.delete(url)

        self.assertEqual(self.pontos_de(self.respondente), 0)

    def test_trocar_a_melhor_resposta_transfere_os_pontos(self):
        """
        A troca desmarca a resposta anterior por atualização em massa, que não
        dispara signals. Sem o recálculo explícito na view, o respondente
        anterior continuaria pontuado indevidamente.
        """
        primeira = criar_resposta(self.respondente, self.topico)
        segunda = criar_resposta(self.outro_respondente, self.topico)
        self.client.force_authenticate(user=self.autor_topico)

        self.client.post(reverse('post-marcar-melhor', args=[primeira.id]))
        self.client.post(reverse('post-marcar-melhor', args=[segunda.id]))

        self.assertEqual(self.pontos_de(self.respondente), 0)
        self.assertEqual(
            self.pontos_de(self.outro_respondente),
            PONTOS_MELHOR_RESPOSTA,
        )


class ConsultaDeReputacaoTests(APITestCase):
    """/api/reputacao/minha/ e /api/reputacao/disciplina/{id}/"""

    def setUp(self):
        self.disciplina = criar_disciplina()
        self.primeiro = criar_usuario(nome='Primeiro Colocado')
        self.segundo = criar_usuario(nome='Segundo Colocado')

        UsuarioDisciplinaReputacao.objects.create(
            usuario=self.primeiro, disciplina=self.disciplina, pontos=100,
        )
        UsuarioDisciplinaReputacao.objects.create(
            usuario=self.segundo, disciplina=self.disciplina, pontos=40,
        )

    def test_minha_reputacao_traz_apenas_o_usuario_autenticado(self):
        self.client.force_authenticate(user=self.segundo)

        resposta = self.client.get(reverse('minha-reputacao'))

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resposta.data), 1)
        self.assertEqual(resposta.data[0]['pontos'], 40)

    def test_ranking_vem_ordenado_por_pontos(self):
        self.client.force_authenticate(user=self.primeiro)

        resposta = self.client.get(
            reverse('ranking-disciplina', args=[self.disciplina.id])
        )

        ranking = resposta.data['ranking']
        self.assertEqual(ranking[0]['posicao'], 1)
        self.assertEqual(ranking[0]['pontos'], 100)
        self.assertEqual(ranking[1]['posicao'], 2)

    def test_ranking_respeita_o_parametro_limite(self):
        self.client.force_authenticate(user=self.primeiro)

        resposta = self.client.get(
            reverse('ranking-disciplina', args=[self.disciplina.id]),
            {'limite': 1},
        )

        self.assertEqual(len(resposta.data['ranking']), 1)

    def test_consulta_exige_autenticacao(self):
        resposta = self.client.get(reverse('minha-reputacao'))

        self.assertEqual(resposta.status_code, status.HTTP_401_UNAUTHORIZED)


class RankingSemestralTests(APITestCase):
    """
    POST /api/reputacao/ranking-semestral/gerar/

    O snapshot congela a classificação do semestre. É o que permite ao aluno
    comprovar depois que ficou entre os primeiros, mesmo que a pontuação ao
    vivo continue mudando.
    """

    def setUp(self):
        self.disciplina = criar_disciplina()
        self.admin = criar_usuario(nome='Administrador', admin=True)
        self.aluno = criar_usuario(nome='Aluno Comum')
        self.destaque = criar_usuario(nome='Aluno Destaque')

        UsuarioDisciplinaReputacao.objects.create(
            usuario=self.destaque, disciplina=self.disciplina, pontos=80,
        )
        UsuarioDisciplinaReputacao.objects.create(
            usuario=self.aluno, disciplina=self.disciplina, pontos=20,
        )

        self.url = reverse('ranking-semestral-gerar')
        self.payload = {'disciplina': str(self.disciplina.id), 'semestre': '2026.1'}

    def test_apenas_admin_pode_gerar(self):
        self.client.force_authenticate(user=self.aluno)

        resposta = self.client.post(self.url, self.payload)

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(RankingSemestral.objects.exists())

    def test_geracao_cria_uma_posicao_por_participante(self):
        self.client.force_authenticate(user=self.admin)

        resposta = self.client.post(self.url, self.payload)

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resposta.data['total_posicoes'], 2)
        self.assertEqual(RankingSemestral.objects.count(), 2)

    def test_posicoes_seguem_a_ordem_de_pontos(self):
        self.client.force_authenticate(user=self.admin)
        self.client.post(self.url, self.payload)

        primeiro = RankingSemestral.objects.get(posicao=1)
        self.assertEqual(primeiro.usuario, self.destaque)
        self.assertEqual(primeiro.pontos, 80)

    def test_snapshot_preserva_o_nome_do_momento_da_geracao(self):
        self.client.force_authenticate(user=self.admin)
        self.client.post(self.url, self.payload)

        self.destaque.nome_completo = 'Nome Alterado Depois'
        self.destaque.save()

        registro = RankingSemestral.objects.get(posicao=1)
        self.assertEqual(registro.nome_usuario, 'Aluno Destaque')

    def test_snapshot_nao_muda_quando_a_pontuacao_evolui(self):
        self.client.force_authenticate(user=self.admin)
        self.client.post(self.url, self.payload)

        reputacao = UsuarioDisciplinaReputacao.objects.get(usuario=self.aluno)
        reputacao.pontos = 500
        reputacao.save()

        registro = RankingSemestral.objects.get(usuario=self.aluno)
        self.assertEqual(registro.pontos, 20)
        self.assertEqual(registro.posicao, 2)

    def test_gerar_de_novo_substitui_o_ranking_anterior(self):
        self.client.force_authenticate(user=self.admin)
        self.client.post(self.url, self.payload)

        reputacao = UsuarioDisciplinaReputacao.objects.get(usuario=self.aluno)
        reputacao.pontos = 500
        reputacao.save()
        self.client.post(self.url, self.payload)

        self.assertEqual(RankingSemestral.objects.count(), 2)
        self.assertEqual(
            RankingSemestral.objects.get(posicao=1).usuario,
            self.aluno,
        )

    def test_campos_obrigatorios_sao_validados(self):
        self.client.force_authenticate(user=self.admin)

        resposta = self.client.post(self.url, {'semestre': '2026.1'})

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_listagem_filtra_por_semestre(self):
        self.client.force_authenticate(user=self.admin)
        self.client.post(self.url, self.payload)

        resposta = self.client.get(
            reverse('ranking-semestral-list'),
            {'semestre': '2025.2'},
        )

        self.assertEqual(len(itens(resposta)), 0)


class RecalculoTotalTests(APITestCase):
    """
    Recálculo total, usado para popular a reputação inicial ou corrigir
    divergências acumuladas.
    """

    def setUp(self):
        self.disciplina = criar_disciplina()
        self.autor = criar_usuario(nome='Autor')
        self.colega = criar_usuario(nome='Colega')
        vincular(self.autor, self.disciplina)

    def test_recalculo_processa_os_pares_com_atividade(self):
        topico = criar_topico(self.autor, self.disciplina)
        Voto.objects.create(usuario=self.colega, post=topico)

        total = recalcular_tudo()

        self.assertGreaterEqual(total, 1)
        reputacao = UsuarioDisciplinaReputacao.objects.get(
            usuario=self.autor, disciplina=self.disciplina,
        )
        self.assertEqual(reputacao.pontos, PONTOS_VOTO_TOPICO)

    def test_comando_de_management_executa_sem_erro(self):
        criar_topico(self.autor, self.disciplina)
        saida = StringIO()

        call_command('recalcular_reputacao', stdout=saida)

        self.assertIn('Recalculo concluido', saida.getvalue())
