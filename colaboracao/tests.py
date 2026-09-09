"""
Testes dos trabalhos em grupo, conversas e pedidos de ajuda.

A privacidade da conversa é a regra que mais importa aqui, e a que quebraria
em silêncio: se o professor passasse a enxergar o chat, nada na tela mudaria e
ninguém perceberia até alguém reclamar.
"""

from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from colaboracao import services
from colaboracao.models import (
    ArquivoTrabalho,
    Conversa,
    GrupoTrabalho,
    MembroGrupo,
    MensagemChat,
    SolicitacaoAjuda,
    Trabalho,
)
from config.testing import criar_disciplina, criar_usuario, itens, vincular
from forum.models import PermissaoDisciplina
from notificacoes.models import Notificacao


def criar_trabalho(disciplina, professor, total_grupos=2, tamanho=3, modo='alunos'):
    return Trabalho.objects.create(
        disciplina=disciplina,
        criado_por=professor,
        titulo='Trabalho de implementação',
        especificacao='Implementar uma estrutura de dados à escolha do grupo.',
        total_grupos=total_grupos,
        tamanho_maximo=tamanho,
        modo_formacao=modo,
        prazo_entrega=timezone.now().date() + timedelta(days=30),
    )


class TrabalhoTests(APITestCase):
    """/api/colaboracao/trabalhos/"""

    def setUp(self):
        self.url = reverse('trabalho-list')
        self.disciplina = criar_disciplina()

        self.professor = criar_usuario(nome='Professor')
        self.aluno = criar_usuario(nome='Aluno')
        self.de_fora = criar_usuario(nome='Aluno de Outra Turma')

        vincular(self.professor, self.disciplina, papel='professor')
        vincular(self.aluno, self.disciplina, papel='aluno')

        self.payload = {
            'disciplina': str(self.disciplina.id),
            'titulo': 'Trabalho de implementação',
            'total_grupos': 2,
            'tamanho_maximo': 3,
            'modo_formacao': 'alunos',
            'prazo_entrega': str(timezone.now().date() + timedelta(days=20)),
        }

    def test_coordenacao_nao_organiza_trabalho_de_turma(self):
        """
        Administrar o curso não é conduzir a turma.

        A coordenação enxerga tudo para poder acompanhar, e é essa amplitude
        que torna o caso perigoso: sem a distinção explícita, quem administra
        passa a organizar equipes de uma disciplina em que não entra. Dividir
        turma e sortear grupo exigem conhecer o enunciado, os alunos e o
        momento do conteúdo — atribuições de quem dá a aula naquele semestre.

        O teste existe porque a falha seria silenciosa: nada na interface
        indicaria que a decisão veio de fora da sala.
        """
        coordenacao = criar_usuario(nome='Coordenadora', admin=True)
        self.client.force_authenticate(user=coordenacao)

        resposta = self.client.post(self.url, self.payload)

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)

    def test_coordenacao_enxerga_os_trabalhos_do_curso(self):
        """
        A contrapartida da regra acima: ver continua permitido.

        Restringir a visibilidade junto com a ação tiraria da coordenação o
        acompanhamento que justifica o papel dela. A separação é entre
        supervisionar e participar, não entre saber e não saber.
        """
        criar_trabalho(self.disciplina, self.professor)

        coordenacao = criar_usuario(nome='Coordenadora', admin=True)
        self.client.force_authenticate(user=coordenacao)

        resposta = self.client.get(self.url)

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(1, len(itens(resposta)))

    def test_professor_anexa_material_ao_enunciado(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        trabalho = criar_trabalho(self.disciplina, self.professor)
        self.client.force_authenticate(user=self.professor)

        resposta = self.client.post(
            reverse('trabalho-anexar', args=[trabalho.id]),
            {
                'arquivo': SimpleUploadedFile(
                    'especificacao.pdf', b'%PDF-1.4 conteudo', content_type='application/pdf',
                ),
            },
            format='multipart',
        )

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertEqual('especificacao.pdf', resposta.data['nome_original'])
        self.assertEqual(1, trabalho.arquivos.count())

    def test_aluno_nao_anexa_material(self):
        """
        Material de apoio é do enunciado, e o enunciado é de quem propõe.

        Deixar qualquer matriculado anexar arquivo ao trabalho abriria caminho
        para o próprio enunciado ser contestado — bastaria juntar um documento
        com outras instruções ao lado das do professor.
        """
        from django.core.files.uploadedfile import SimpleUploadedFile

        trabalho = criar_trabalho(self.disciplina, self.professor)
        self.client.force_authenticate(user=self.aluno)

        resposta = self.client.post(
            reverse('trabalho-anexar', args=[trabalho.id]),
            {
                'arquivo': SimpleUploadedFile(
                    'outro.pdf', b'%PDF-1.4', content_type='application/pdf',
                ),
            },
            format='multipart',
        )

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(0, trabalho.arquivos.count())

    def test_formato_nao_aceito_e_recusado(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        trabalho = criar_trabalho(self.disciplina, self.professor)
        self.client.force_authenticate(user=self.professor)

        resposta = self.client.post(
            reverse('trabalho-anexar', args=[trabalho.id]),
            {
                'arquivo': SimpleUploadedFile(
                    'script.sh', b'#!/bin/bash', content_type='application/x-sh',
                ),
            },
            format='multipart',
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_professor_cria_trabalho(self):
        self.client.force_authenticate(user=self.professor)

        resposta = self.client.post(self.url, self.payload)

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)

    def test_aluno_nao_cria_trabalho(self):
        """Dividir a turma em grupos é decisão pedagógica."""
        self.client.force_authenticate(user=self.aluno)

        resposta = self.client.post(self.url, self.payload)

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)

    def test_quem_nao_cursa_a_disciplina_nao_ve_o_trabalho(self):
        criar_trabalho(self.disciplina, self.professor)
        self.client.force_authenticate(user=self.de_fora)

        resposta = self.client.get(self.url)

        self.assertEqual(len(itens(resposta)), 0)


class FormacaoDeGruposTests(APITestCase):
    """Criação dos grupos e entrada dos participantes."""

    def setUp(self):
        self.disciplina = criar_disciplina()
        self.professor = criar_usuario(nome='Professor')
        vincular(self.professor, self.disciplina, papel='professor')

        self.turma = [
            criar_usuario(nome=f'Estudante {numero}') for numero in range(1, 6)
        ]
        for estudante in self.turma:
            vincular(estudante, self.disciplina, papel='aluno')

        self.trabalho = criar_trabalho(self.disciplina, self.professor)

    def test_criar_grupos_abre_a_conversa_de_cada_um(self):
        """
        A conversa nasce com o grupo. Se esperasse o primeiro acesso, quem não
        abrisse o chat não estaria na lista e não receberia notificação.
        """
        services.criar_grupos_vazios(self.trabalho)

        self.assertEqual(GrupoTrabalho.objects.count(), 2)
        self.assertEqual(Conversa.objects.filter(tipo='grupo').count(), 2)

    def test_sorteio_distribui_de_forma_equilibrada(self):
        """
        Cinco pessoas em dois grupos dão três e dois, nunca quatro e um: a
        distribuição é circular, e não sequencial.
        """
        services.sortear_grupos(self.trabalho)

        tamanhos = sorted(
            grupo.membros.count() for grupo in self.trabalho.grupos.all()
        )
        self.assertEqual(tamanhos, [2, 3])

    def test_sorteio_recusa_turma_maior_que_as_vagas(self):
        for numero in range(6, 10):
            estudante = criar_usuario(nome=f'Estudante {numero}')
            vincular(estudante, self.disciplina, papel='aluno')

        with self.assertRaises(services.RegraDeGrupo):
            services.sortear_grupos(self.trabalho)

    def test_sorteio_define_um_lider_por_grupo(self):
        services.sortear_grupos(self.trabalho)

        for grupo in self.trabalho.grupos.all():
            self.assertEqual(grupo.membros.filter(e_lider=True).count(), 1)

    def test_estudante_entra_no_grupo(self):
        services.criar_grupos_vazios(self.trabalho)
        grupo = self.trabalho.grupos.first()

        services.entrar_no_grupo(grupo, self.turma[0])

        self.assertEqual(grupo.membros.count(), 1)

    def test_primeiro_a_entrar_vira_lider(self):
        services.criar_grupos_vazios(self.trabalho)
        grupo = self.trabalho.grupos.first()

        membro = services.entrar_no_grupo(grupo, self.turma[0])

        self.assertTrue(membro.e_lider)

    def test_nao_entra_em_dois_grupos_do_mesmo_trabalho(self):
        services.criar_grupos_vazios(self.trabalho)
        primeiro, segundo = list(self.trabalho.grupos.all())
        services.entrar_no_grupo(primeiro, self.turma[0])

        with self.assertRaises(services.RegraDeGrupo):
            services.entrar_no_grupo(segundo, self.turma[0])

    def test_grupo_cheio_recusa_novo_membro(self):
        services.criar_grupos_vazios(self.trabalho)
        grupo = self.trabalho.grupos.first()

        for estudante in self.turma[:3]:
            services.entrar_no_grupo(grupo, estudante)

        with self.assertRaises(services.RegraDeGrupo):
            services.entrar_no_grupo(grupo, self.turma[3])

    def test_quem_nao_cursa_a_disciplina_nao_entra(self):
        services.criar_grupos_vazios(self.trabalho)
        grupo = self.trabalho.grupos.first()
        estranho = criar_usuario(nome='Estranho')

        with self.assertRaises(services.RegraDeGrupo):
            services.entrar_no_grupo(grupo, estranho)

    def test_saida_do_lider_transfere_a_lideranca(self):
        """Grupo sem líder trava a organização."""
        services.criar_grupos_vazios(self.trabalho)
        grupo = self.trabalho.grupos.first()
        services.entrar_no_grupo(grupo, self.turma[0])
        services.entrar_no_grupo(grupo, self.turma[1])

        services.sair_do_grupo(grupo, self.turma[0])

        self.assertEqual(grupo.membros.count(), 1)
        self.assertTrue(grupo.membros.first().e_lider)

    def test_entrada_e_saida_ajustam_a_conversa(self):
        services.criar_grupos_vazios(self.trabalho)
        grupo = self.trabalho.grupos.first()

        services.entrar_no_grupo(grupo, self.turma[0])
        self.assertEqual(grupo.conversa.participantes.count(), 1)

        services.sair_do_grupo(grupo, self.turma[0])
        self.assertEqual(grupo.conversa.participantes.count(), 0)


class PrivacidadeDaConversaTests(APITestCase):
    """
    A conversa do grupo é privada aos membros, inclusive para o professor.

    É a decisão que sustenta o desenho: sem privacidade, os grupos migram para
    aplicativos externos e o material se perde no fim do semestre.
    """

    def setUp(self):
        self.disciplina = criar_disciplina()
        self.professor = criar_usuario(nome='Professor')
        self.membro = criar_usuario(nome='Membro do Grupo')
        self.colega = criar_usuario(nome='Colega de Turma')

        vincular(self.professor, self.disciplina, papel='professor')
        vincular(self.membro, self.disciplina, papel='aluno')
        vincular(self.colega, self.disciplina, papel='aluno')

        trabalho = criar_trabalho(self.disciplina, self.professor)
        services.criar_grupos_vazios(trabalho)

        self.grupo = trabalho.grupos.first()
        services.entrar_no_grupo(self.grupo, self.membro)
        self.conversa = self.grupo.conversa

    def test_membro_ve_a_conversa(self):
        self.client.force_authenticate(user=self.membro)

        resposta = self.client.get(reverse('conversa-list'))

        self.assertEqual(len(itens(resposta)), 1)

    def test_professor_nao_ve_a_conversa_do_grupo(self):
        self.client.force_authenticate(user=self.professor)

        resposta = self.client.get(reverse('conversa-list'))

        self.assertEqual(len(itens(resposta)), 0)

    def test_colega_de_turma_fora_do_grupo_nao_ve(self):
        self.client.force_authenticate(user=self.colega)

        resposta = self.client.get(reverse('conversa-list'))

        self.assertEqual(len(itens(resposta)), 0)

    def test_professor_nao_le_as_mensagens(self):
        self.client.force_authenticate(user=self.professor)

        resposta = self.client.get(
            reverse('conversa-mensagens', args=[self.conversa.id])
        )

        self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)

    def test_membro_envia_mensagem(self):
        self.client.force_authenticate(user=self.membro)

        resposta = self.client.post(
            reverse('conversa-mensagens', args=[self.conversa.id]),
            {'conteudo': 'Consegui rodar a primeira parte.'},
        )

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(MensagemChat.objects.count(), 1)

    def test_mensagem_vazia_e_recusada(self):
        self.client.force_authenticate(user=self.membro)

        resposta = self.client.post(
            reverse('conversa-mensagens', args=[self.conversa.id]),
            {'conteudo': '   '},
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_conversa_arquivada_nao_aceita_mensagem(self):
        self.conversa.arquivada_em = timezone.now()
        self.conversa.save(update_fields=['arquivada_em'])
        self.client.force_authenticate(user=self.membro)

        resposta = self.client.post(
            reverse('conversa-mensagens', args=[self.conversa.id]),
            {'conteudo': 'Ainda dá para responder?'},
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)


class PedidoDeAjudaTests(APITestCase):
    """
    O pedido de ajuda é o único ponto em que conteúdo do chat privado chega a
    quem ensina, e ainda assim recortado: só a mensagem marcada e a descrição.
    """

    def setUp(self):
        self.disciplina = criar_disciplina()
        self.professor = criar_usuario(nome='Professor')
        self.monitor = criar_usuario(nome='Monitor')
        self.membro = criar_usuario(nome='Membro')
        self.outro_membro = criar_usuario(nome='Outro Membro')

        vincular(self.professor, self.disciplina, papel='professor')
        vincular(self.monitor, self.disciplina, papel='monitor')
        vincular(self.membro, self.disciplina, papel='aluno')
        vincular(self.outro_membro, self.disciplina, papel='aluno')

        trabalho = criar_trabalho(self.disciplina, self.professor)
        services.criar_grupos_vazios(trabalho)
        self.grupo = trabalho.grupos.first()

        services.entrar_no_grupo(self.grupo, self.membro)
        services.entrar_no_grupo(self.grupo, self.outro_membro)

        self.mensagem = MensagemChat.objects.create(
            conversa=self.grupo.conversa,
            autor=self.membro,
            conteudo='Ninguém do grupo sabe como tratar o caso de lista vazia.',
        )

    def url(self):
        return reverse('mensagem-pedir-ajuda', args=[self.mensagem.id])

    def test_membro_pede_ajuda(self):
        self.client.force_authenticate(user=self.membro)

        resposta = self.client.post(self.url(), {'descricao': 'Travamos aqui.'})

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(SolicitacaoAjuda.objects.count(), 1)

    def test_qualquer_membro_pode_marcar_nao_so_o_autor(self):
        """Quem percebe que a dúvida travou o grupo costuma ser outra pessoa."""
        self.client.force_authenticate(user=self.outro_membro)

        resposta = self.client.post(self.url(), {'descricao': 'Continuamos parados.'})

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)

    def test_quem_esta_fora_do_grupo_nao_pede(self):
        self.client.force_authenticate(user=self.professor)

        resposta = self.client.post(self.url(), {})

        self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)

    def test_monitoria_e_professor_sao_notificados(self):
        self.client.force_authenticate(user=self.membro)

        self.client.post(self.url(), {'descricao': 'Travamos aqui.'})

        destinatarios = set(
            Notificacao.objects.filter(tipo='ajuda_solicitada')
            .values_list('destinatario_id', flat=True)
        )
        self.assertIn(self.monitor.id, destinatarios)
        self.assertIn(self.professor.id, destinatarios)

    def test_sem_monitoria_o_professor_recebe(self):
        """Disciplina sem monitor encaminha ao professor, de forma transparente."""
        from forum.models import PermissaoDisciplina

        PermissaoDisciplina.objects.filter(
            usuario=self.monitor, disciplina=self.disciplina,
        ).delete()

        self.client.force_authenticate(user=self.membro)
        self.client.post(self.url(), {'destino': 'monitoria'})

        destinatarios = set(
            Notificacao.objects.filter(tipo='ajuda_solicitada')
            .values_list('destinatario_id', flat=True)
        )
        self.assertIn(self.professor.id, destinatarios)

    def test_nao_duplica_pedido_na_mesma_mensagem(self):
        self.client.force_authenticate(user=self.membro)
        self.client.post(self.url(), {})

        resposta = self.client.post(self.url(), {})

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)

    def test_professor_ve_o_pedido_mas_nao_a_conversa(self):
        services.pedir_ajuda(self.mensagem, self.membro, 'Travamos aqui.')
        self.client.force_authenticate(user=self.professor)

        pedidos = self.client.get(reverse('ajuda-list'))
        conversas = self.client.get(reverse('conversa-list'))

        self.assertEqual(len(itens(pedidos)), 1)
        self.assertEqual(len(itens(conversas)), 0)

    def test_resposta_volta_ao_chat_do_grupo(self):
        """
        A solução entra na própria conversa, onde a dúvida nasceu, para que o
        grupo inteiro veja e não apenas quem pediu.
        """
        solicitacao = services.pedir_ajuda(self.mensagem, self.membro)
        self.client.force_authenticate(user=self.monitor)

        resposta = self.client.post(
            reverse('ajuda-responder', args=[solicitacao.id]),
            {'resposta': 'Trate o caso de lista vazia antes do laço principal.'},
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.assertEqual(self.grupo.conversa.mensagens.count(), 2)

    def test_colega_de_grupo_nao_enxerga_pedido_alheio(self):
        """
        Quem não pediu ajuda nem ensina a disciplina recebe 404, não 403.

        A resposta é 404 de propósito: 403 confirmaria que o pedido existe, e
        a fila de ajuda é visível apenas a quem pediu e a quem atende. Negar a
        existência é o comportamento correto para quem está fora dos dois
        grupos — inclusive para um colega do mesmo grupo de trabalho.
        """
        solicitacao = services.pedir_ajuda(self.mensagem, self.membro)
        self.client.force_authenticate(user=self.outro_membro)

        resposta = self.client.post(
            reverse('ajuda-responder', args=[solicitacao.id]),
            {'resposta': 'Acho que é assim.'},
        )

        self.assertEqual(resposta.status_code, status.HTTP_404_NOT_FOUND)

    def test_segundo_atendente_recebe_conflito(self):
        solicitacao = services.pedir_ajuda(self.mensagem, self.membro)

        self.client.force_authenticate(user=self.monitor)
        self.client.post(reverse('ajuda-assumir', args=[solicitacao.id]))

        self.client.force_authenticate(user=self.professor)
        resposta = self.client.post(reverse('ajuda-assumir', args=[solicitacao.id]))

        self.assertEqual(resposta.status_code, status.HTTP_409_CONFLICT)


class ContadorNaoLidasTests(APITestCase):
    """O marcador de leitura fica no participante, não na mensagem."""

    def setUp(self):
        self.disciplina = criar_disciplina()
        self.professor = criar_usuario(nome='Professor')
        self.membro = criar_usuario(nome='Membro')
        self.colega = criar_usuario(nome='Colega de Grupo')

        vincular(self.professor, self.disciplina, papel='professor')
        vincular(self.membro, self.disciplina, papel='aluno')
        vincular(self.colega, self.disciplina, papel='aluno')

        trabalho = criar_trabalho(self.disciplina, self.professor)
        services.criar_grupos_vazios(trabalho)
        self.grupo = trabalho.grupos.first()

        services.entrar_no_grupo(self.grupo, self.membro)
        services.entrar_no_grupo(self.grupo, self.colega)
        self.conversa = self.grupo.conversa

    def test_mensagem_do_colega_conta_como_nao_lida(self):
        MensagemChat.objects.create(
            conversa=self.conversa, autor=self.colega, conteudo='Comecei a parte 2.',
        )

        self.assertEqual(services.nao_lidas(self.conversa, self.membro), 1)

    def test_mensagem_propria_nao_conta(self):
        MensagemChat.objects.create(
            conversa=self.conversa, autor=self.membro, conteudo='Vou fazer a parte 1.',
        )

        self.assertEqual(services.nao_lidas(self.conversa, self.membro), 0)

    def test_registrar_leitura_zera_o_contador(self):
        MensagemChat.objects.create(
            conversa=self.conversa, autor=self.colega, conteudo='Comecei a parte 2.',
        )

        services.registrar_leitura(self.conversa, self.membro)

        self.assertEqual(services.nao_lidas(self.conversa, self.membro), 0)


class MonitorNaoDesenhaAvaliacaoTests(APITestCase):
    """
    O monitor conduz a turma, mas não desenha a avaliação.

    A distinção não é evidente: monitor e professor compartilham a moderação,
    o atendimento de dúvidas e o acompanhamento dos grupos. Propor trabalho,
    abrir os grupos e sortear a turma, porém, definem como os colegas do
    monitor serão avaliados — e ele é, quase sempre, aluno da própria turma.
    """

    def setUp(self):
        self.disciplina = criar_disciplina()
        self.professor = criar_usuario(nome='Professor Responsável')
        self.monitor = criar_usuario(nome='Monitor da Turma')

        vincular(self.professor, self.disciplina, papel='professor')
        vincular(self.monitor, self.disciplina, papel='monitor')

        self.trabalho = criar_trabalho(self.disciplina, self.professor)

    def corpo_do_trabalho(self):
        return {
            'disciplina': str(self.disciplina.id),
            'titulo': 'Trabalho proposto pelo monitor',
            'especificacao': 'Enunciado qualquer.',
            'total_grupos': 2,
            'tamanho_maximo': 3,
            'modo_formacao': 'alunos',
            'prazo_entrega': (timezone.now().date() + timedelta(days=20)).isoformat(),
        }

    def test_monitor_nao_cria_trabalho(self):
        self.client.force_authenticate(user=self.monitor)

        resposta = self.client.post(reverse('trabalho-list'), self.corpo_do_trabalho())

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)

    def test_professor_cria_trabalho(self):
        self.client.force_authenticate(user=self.professor)

        resposta = self.client.post(reverse('trabalho-list'), self.corpo_do_trabalho())

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)

    def test_monitor_nao_sorteia_a_turma(self):
        self.client.force_authenticate(user=self.monitor)

        resposta = self.client.post(
            reverse('trabalho-sortear', args=[self.trabalho.id])
        )

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)

    def test_monitor_nao_abre_os_grupos(self):
        self.client.force_authenticate(user=self.monitor)

        resposta = self.client.post(
            reverse('trabalho-criar-grupos', args=[self.trabalho.id])
        )

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)

    def test_monitor_continua_enxergando_os_trabalhos(self):
        """A restrição é sobre criar, não sobre acompanhar."""
        self.client.force_authenticate(user=self.monitor)

        resposta = self.client.get(reverse('trabalho-list'))

        self.assertEqual(len(itens(resposta)), 1)

    def test_monitor_continua_respondendo_pedido_de_ajuda(self):
        """
        Atender dúvida é atribuição da monitoria, e permanece.

        Sem este teste, um endurecimento futuro das permissões poderia
        alcançar também o atendimento, que é a razão de existir da monitoria.
        """
        from config.permissions import leciona_disciplina

        self.assertTrue(leciona_disciplina(self.monitor, self.disciplina))


class CanalDeMonitoriaTests(APITestCase):
    """
    O canal reúne quem conduz uma disciplina, e apenas aquela.

    É o ponto que define o recurso: monitor de uma matéria não alcança o canal
    de outra, e professor de uma matéria não lê o que se discute na monitoria
    de outra. O recorte segue o vínculo, como no resto da plataforma.
    """

    def setUp(self):
        self.banco = criar_disciplina(codigo='CTCO03', nome='Banco de Dados')
        self.algoritmos = criar_disciplina(codigo='CTCO01', nome='Algoritmos')

        self.professor_banco = criar_usuario(nome='Professor de Banco')
        self.monitor_banco = criar_usuario(nome='Monitor de Banco')
        self.professor_algoritmos = criar_usuario(nome='Professor de Algoritmos')
        self.aluno = criar_usuario(nome='Aluno Comum')

        vincular(self.professor_banco, self.banco, papel='professor')
        vincular(self.professor_algoritmos, self.algoritmos, papel='professor')
        vincular(self.aluno, self.banco, papel='aluno')

        # A promoção a monitor é o que faz o canal nascer.
        vincular(self.monitor_banco, self.banco, papel='monitor')

    def canal(self, disciplina):
        return Conversa.objects.filter(tipo='monitoria', disciplina=disciplina).first()

    def conversas_de(self, usuario):
        self.client.force_authenticate(user=usuario)
        resposta = self.client.get(reverse('conversa-list'))
        return itens(resposta)

    def test_canal_nasce_com_a_monitoria(self):
        canal = self.canal(self.banco)

        self.assertIsNotNone(canal)
        self.assertEqual(canal.tipo, 'monitoria')

    def test_professor_e_monitor_da_materia_participam(self):
        canal = self.canal(self.banco)
        participantes = set(canal.participantes.values_list('usuario_id', flat=True))

        self.assertIn(self.professor_banco.id, participantes)
        self.assertIn(self.monitor_banco.id, participantes)

    def test_aluno_da_materia_nao_participa(self):
        """O canal é de quem conduz a turma, não de quem a cursa."""
        canal = self.canal(self.banco)
        participantes = set(canal.participantes.values_list('usuario_id', flat=True))

        self.assertNotIn(self.aluno.id, participantes)

    def test_professor_de_outra_materia_nao_enxerga_o_canal(self):
        """
        O ponto sensível do recurso.

        Cada canal pertence a uma disciplina. Se o professor de algoritmos
        alcançasse o canal de banco de dados, o recorte por matéria não
        existiria de fato.
        """
        titulos = [c['titulo'] for c in self.conversas_de(self.professor_algoritmos)]

        self.assertNotIn('Monitoria de CTCO03', titulos)

    def test_monitor_enxerga_o_canal_da_propria_materia(self):
        titulos = [c['titulo'] for c in self.conversas_de(self.monitor_banco)]

        self.assertIn('Monitoria de CTCO03', titulos)

    def test_disciplina_sem_monitor_nao_ganha_canal(self):
        """Canal do professor consigo mesmo ocuparia a lista sem servir a nada."""
        self.assertIsNone(self.canal(self.algoritmos))

    def test_fim_da_monitoria_arquiva_o_canal(self):
        """
        O histórico permanece, mas o canal para de aceitar mensagem.

        Apagar eliminaria o registro de combinações que podem ter valido para
        a turma inteira.
        """
        vinculo = PermissaoDisciplina.objects.get(
            usuario=self.monitor_banco, disciplina=self.banco,
        )
        vinculo.ativo = False
        vinculo.save()

        canal = self.canal(self.banco)

        self.assertIsNotNone(canal)
        self.assertTrue(canal.somente_leitura)

    def test_monitoria_reconstituida_reabre_o_canal(self):
        vinculo = PermissaoDisciplina.objects.get(
            usuario=self.monitor_banco, disciplina=self.banco,
        )
        vinculo.ativo = False
        vinculo.save()

        vinculo.ativo = True
        vinculo.save()

        canal = self.canal(self.banco)

        self.assertFalse(canal.somente_leitura)


class AcervoDeArquivosTests(APITestCase):
    """
    O acervo reúne arquivos de três origens sem afrouxar nenhum controle.

    É o risco próprio de um agregador: ao juntar o que estava separado, ele
    pode tornar acessível num lugar o que não era em outro. Os testes abaixo
    verificam justamente isso — que o recorte de cada origem sobrevive à
    reunião.
    """

    def setUp(self):
        self.disciplina = criar_disciplina()
        self.professor = criar_usuario(nome='Professor')
        self.membro = criar_usuario(nome='Membro do Grupo')
        self.colega = criar_usuario(nome='Colega de Turma')

        vincular(self.professor, self.disciplina, papel='professor')
        vincular(self.membro, self.disciplina, papel='aluno')
        vincular(self.colega, self.disciplina, papel='aluno')

        trabalho = criar_trabalho(self.disciplina, self.professor)
        services.criar_grupos_vazios(trabalho)

        self.grupo = trabalho.grupos.first()
        services.entrar_no_grupo(self.grupo, self.membro)
        self.conversa = self.grupo.conversa

        self.mensagem = MensagemChat.objects.create(
            conversa=self.conversa,
            autor=self.membro,
            arquivo=SimpleUploadedFile('esboco.pdf', b'conteudo'),
            nome_original='esboco.pdf',
            tipo_midia='documento',
        )

        self.url = reverse('acervo-arquivos')

    def arquivos_de(self, usuario):
        """Achata os grupos por disciplina numa lista só, para facilitar a asserção."""
        self.client.force_authenticate(user=usuario)
        resposta = self.client.get(self.url)

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)

        return [
            arquivo
            for grupo in resposta.data['grupos']
            for arquivo in grupo['arquivos']
        ]

    def test_membro_encontra_o_proprio_anexo(self):
        nomes = [a['nome'] for a in self.arquivos_de(self.membro)]

        self.assertIn('esboco.pdf', nomes)

    def test_colega_fora_do_grupo_nao_ve_o_anexo(self):
        """
        O ponto sensível de todo o recurso.

        A conversa do grupo é privada, e o colega da mesma turma não participa
        dela. Se o anexo aparecesse aqui, o acervo teria aberto uma porta que a
        conversa mantém fechada.
        """
        nomes = [a['nome'] for a in self.arquivos_de(self.colega)]

        self.assertNotIn('esboco.pdf', nomes)

    def test_professor_nao_ve_o_anexo_do_grupo(self):
        """Quem leciona supervisiona o trabalho, mas não lê a conversa dele."""
        nomes = [a['nome'] for a in self.arquivos_de(self.professor)]

        self.assertNotIn('esboco.pdf', nomes)

    def test_mensagem_apagada_leva_o_anexo_junto(self):
        self.mensagem.deleted_at = timezone.now()
        self.mensagem.save(update_fields=['deleted_at'])

        nomes = [a['nome'] for a in self.arquivos_de(self.membro)]

        self.assertNotIn('esboco.pdf', nomes)

    def test_material_do_trabalho_alcanca_a_turma_inteira(self):
        """
        Ao contrário do anexo de conversa: material de apoio é da turma.

        O colega não participa do grupo, mas cursa a disciplina — e é para ele
        que o professor publicou a especificação.
        """
        ArquivoTrabalho.objects.create(
            trabalho=self.grupo.trabalho,
            enviado_por=self.professor,
            arquivo=SimpleUploadedFile('especificacao.pdf', b'conteudo'),
            nome_original='especificacao.pdf',
            tamanho_bytes=8,
            tipo_mime='application/pdf',
        )

        nomes = [a['nome'] for a in self.arquivos_de(self.colega)]

        self.assertIn('especificacao.pdf', nomes)

    def test_sem_vinculo_com_a_disciplina_o_acervo_vem_vazio(self):
        visitante = criar_usuario(nome='Sem Vínculo')

        self.assertEqual(self.arquivos_de(visitante), [])

    def test_arquivos_vem_agrupados_pela_disciplina(self):
        self.client.force_authenticate(user=self.membro)

        resposta = self.client.get(self.url)
        grupos = resposta.data['grupos']

        self.assertEqual(len(grupos), 1)
        self.assertEqual(grupos[0]['disciplina_codigo'], self.disciplina.codigo)
