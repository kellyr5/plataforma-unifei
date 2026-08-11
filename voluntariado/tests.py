"""
Testes do módulo de voluntariado.

Percorrem o ciclo completo, da inscrição do estudante até a emissão do
certificado, verificando as restrições de vagas, prazo e permissão da
organização, além do endpoint público de validação, que é o que garante
que o certificado tenha valor fora da plataforma.
"""

import shutil
import tempfile
from datetime import timedelta

from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from config.testing import criar_oportunidade, criar_usuario
from voluntariado.models import Certificado, InscricaoVoluntariado


# Os certificados geram PDF em disco. Direcionamos os uploads para uma pasta
# temporária, que é apagada ao fim da classe, para não sujar a pasta media/.
MEDIA_TEMPORARIA = tempfile.mkdtemp()


class InscricaoTests(APITestCase):
    """
    POST /api/voluntariado/oportunidades/{id}/inscrever/

    O status inicial da inscrição depende da política da organização, definida
    no campo requer_aprovacao da oportunidade.
    """

    def setUp(self):
        self.ong = criar_usuario(nome='ONG Parceira', ong=True)
        self.estudante = criar_usuario(nome='Estudante Voluntário')

    def url(self, oportunidade):
        return reverse('oportunidade-inscrever', args=[oportunidade.id])

    def test_inscricao_fica_pendente_quando_requer_aprovacao(self):
        oportunidade = criar_oportunidade(self.ong, requer_aprovacao=True)
        self.client.force_authenticate(user=self.estudante)

        resposta = self.client.post(self.url(oportunidade), {'motivacao': 'Quero ajudar.'})

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resposta.data['status'], 'pendente')

    def test_inscricao_e_aprovada_automaticamente_quando_dispensa_aprovacao(self):
        oportunidade = criar_oportunidade(self.ong, requer_aprovacao=False)
        self.client.force_authenticate(user=self.estudante)

        resposta = self.client.post(self.url(oportunidade))

        self.assertEqual(resposta.data['status'], 'aprovada')

    def test_organizacao_nao_pode_se_inscrever_na_propria_oportunidade(self):
        oportunidade = criar_oportunidade(self.ong)
        self.client.force_authenticate(user=self.ong)

        resposta = self.client.post(self.url(oportunidade))

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_inscricao_duplicada_e_rejeitada(self):
        oportunidade = criar_oportunidade(self.ong)
        self.client.force_authenticate(user=self.estudante)
        self.client.post(self.url(oportunidade))

        resposta = self.client.post(self.url(oportunidade))

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(InscricaoVoluntariado.objects.count(), 1)

    def test_prazo_encerrado_bloqueia_inscricao(self):
        oportunidade = criar_oportunidade(self.ong)
        oportunidade.prazo_inscricao = timezone.now().date() - timedelta(days=1)
        oportunidade.save()
        self.client.force_authenticate(user=self.estudante)

        resposta = self.client.post(self.url(oportunidade))

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_vagas_esgotadas_bloqueiam_inscricao(self):
        """A vaga só é considerada ocupada quando a inscrição está aprovada ou concluída."""
        oportunidade = criar_oportunidade(self.ong, vagas=1, requer_aprovacao=False)
        primeiro = criar_usuario(nome='Primeiro Inscrito')
        self.client.force_authenticate(user=primeiro)
        self.client.post(self.url(oportunidade))

        self.client.force_authenticate(user=self.estudante)
        resposta = self.client.post(self.url(oportunidade))

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)


class AprovacaoTests(APITestCase):
    """
    Decisões da organização sobre a inscrição.

    A visibilidade das inscrições é filtrada no get_queryset, então uma
    organização alheia sequer enxerga o registro, recebendo 404 em vez de 403.
    """

    def setUp(self):
        self.ong = criar_usuario(nome='ONG Parceira', ong=True)
        self.outra_ong = criar_usuario(nome='ONG Concorrente', ong=True)
        self.estudante = criar_usuario(nome='Estudante Voluntário')
        self.oportunidade = criar_oportunidade(self.ong)
        self.inscricao = InscricaoVoluntariado.objects.create(
            oportunidade=self.oportunidade,
            estudante=self.estudante,
        )

    def test_organizacao_dona_aprova_inscricao(self):
        self.client.force_authenticate(user=self.ong)

        resposta = self.client.post(
            reverse('inscricao-aprovar', args=[self.inscricao.id])
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.inscricao.refresh_from_db()
        self.assertEqual(self.inscricao.status, 'aprovada')

    def test_organizacao_alheia_nao_enxerga_a_inscricao(self):
        self.client.force_authenticate(user=self.outra_ong)

        resposta = self.client.post(
            reverse('inscricao-aprovar', args=[self.inscricao.id])
        )

        self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)
        self.inscricao.refresh_from_db()
        self.assertEqual(self.inscricao.status, 'pendente')

    def test_estudante_ve_apenas_as_proprias_inscricoes(self):
        outro_estudante = criar_usuario(nome='Outro Estudante')
        self.client.force_authenticate(user=outro_estudante)

        resposta = self.client.get(reverse('inscricao-list'))

        self.assertEqual(len(resposta.data), 0)


@override_settings(MEDIA_ROOT=MEDIA_TEMPORARIA)
class CertificadoTests(APITestCase):
    """
    POST /api/voluntariado/inscricoes/{id}/concluir/

    A conclusão é a única porta de emissão do certificado, e os dados são
    congelados no momento da emissão para que o documento continue válido
    mesmo se a oportunidade ou o perfil mudarem depois.
    """

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(MEDIA_TEMPORARIA, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.ong = criar_usuario(nome='ONG Parceira', ong=True)
        self.estudante = criar_usuario(nome='Estudante Voluntário')
        self.oportunidade = criar_oportunidade(self.ong)
        self.inscricao = InscricaoVoluntariado.objects.create(
            oportunidade=self.oportunidade,
            estudante=self.estudante,
            status='aprovada',
        )
        self.url = reverse('inscricao-concluir', args=[self.inscricao.id])

    def test_conclusao_emite_certificado(self):
        self.client.force_authenticate(user=self.ong)

        resposta = self.client.post(self.url, {'horas_realizadas': 40})

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.inscricao.refresh_from_db()
        self.assertEqual(self.inscricao.status, 'concluida')
        self.assertTrue(Certificado.objects.filter(inscricao=self.inscricao).exists())

    def test_certificado_congela_os_dados_do_servico(self):
        self.client.force_authenticate(user=self.ong)
        self.client.post(self.url, {'horas_realizadas': 35})

        certificado = Certificado.objects.get(inscricao=self.inscricao)
        self.assertEqual(certificado.nome_estudante, self.estudante.nome_completo)
        self.assertEqual(certificado.cpf_estudante, self.estudante.cpf)
        self.assertEqual(certificado.horas_realizadas, 35)

    def test_inscricao_pendente_nao_pode_ser_concluida(self):
        self.inscricao.status = 'pendente'
        self.inscricao.save()
        self.client.force_authenticate(user=self.ong)

        resposta = self.client.post(self.url, {'horas_realizadas': 40})

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Certificado.objects.exists())

    def test_horas_invalidas_sao_rejeitadas(self):
        self.client.force_authenticate(user=self.ong)

        resposta = self.client.post(self.url, {'horas_realizadas': 0})

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_estudante_nao_pode_concluir_a_propria_inscricao(self):
        """O estudante enxerga a inscrição, mas não pode decidir sobre ela."""
        self.client.force_authenticate(user=self.estudante)

        resposta = self.client.post(self.url, {'horas_realizadas': 40})

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)

    def test_validacao_publica_dispensa_autenticacao(self):
        """Permite que um empregador confira o certificado sem ter conta na plataforma."""
        self.client.force_authenticate(user=self.ong)
        self.client.post(self.url, {'horas_realizadas': 40})
        certificado = Certificado.objects.get(inscricao=self.inscricao)

        self.client.force_authenticate(user=None)
        resposta = self.client.get(
            f'/api/voluntariado/certificados/validar/{certificado.codigo_validacao}/'
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)

    def test_codigo_inexistente_retorna_404(self):
        self.client.force_authenticate(user=None)

        resposta = self.client.get(
            '/api/voluntariado/certificados/validar/CODIGOINVALIDO/'
        )

        self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)
