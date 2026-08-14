"""
Cria um usuario de cada perfil, com dados suficientes para navegar o sistema.

Uso:
    python manage.py importar_matriz_ppc docs/ppc-cco.txt --curso CCO --nome "Ciencia da Computacao"
    python manage.py criar_perfis_demo

Serve para conferir como cada perfil enxerga a plataforma, porque varias telas
so fazem sentido com dado dentro: a fila de moderacao precisa de denuncia, o
painel de andamento precisa de participacao, o voluntariado precisa de
oportunidade publicada. Sem isso, tudo aparece vazio e nao da para avaliar.

O comando e idempotente: rodar de novo atualiza em vez de duplicar.

Nao use em producao. As senhas sao conhecidas e as contas ja nascem ativas,
pulando a verificacao por codigo.
"""

from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from autenticacao.models import RoleGlobal, Usuario
from forum.models import (
    AlertaConteudo,
    Disciplina,
    PermissaoDisciplina,
    Post,
)
from notificacoes.services import criar_notificacao
from voluntariado.models import Oportunidade


SENHA = 'Demo2026.'

PERFIS = [
    {
        'chave': 'coordenacao',
        'cpf': '10000000001',
        'nome': 'Ana Beatriz Ferreira',
        'email': 'coordenacao.demo@unifei.edu.br',
        'matricula': '',
        'genero': 'f',
        'admin': True,
    },
    {
        'chave': 'professor',
        'cpf': '10000000002',
        'nome': 'Rafael Andrade',
        'email': 'professor.demo@unifei.edu.br',
        'matricula': 'D2019001',
        'genero': 'm',
        'admin': False,
    },
    {
        'chave': 'monitor',
        'cpf': '10000000003',
        'nome': 'Carla Nogueira',
        'email': 'monitor.demo@unifei.edu.br',
        'matricula': '2022001234',
        'genero': 'f',
        'admin': False,
    },
    {
        'chave': 'aluno',
        'cpf': '10000000004',
        'nome': 'Diego Martins',
        'email': 'aluno.demo@unifei.edu.br',
        'matricula': '2024005678',
        'genero': 'm',
        'admin': False,
    },
    {
        # Segundo estudante na mesma turma. Existe porque conversa de grupo,
        # divisao de trabalho e pedido de ajuda so podem ser avaliados com duas
        # pessoas distintas: com uma so, a tela nunca mostra o outro lado.
        'chave': 'aluno2',
        'cpf': '10000000006',
        'nome': 'Larissa Campos',
        'email': 'aluno2.demo@unifei.edu.br',
        'matricula': '2024005679',
        'genero': 'f',
        'admin': False,
    },
    {
        'chave': 'organizacao',
        'cpf': '10000000005',
        'nome': 'Instituto Semear',
        'email': 'ong.demo@unifei.edu.br',
        'matricula': '',
        'genero': 'n',
        'admin': False,
        'ong': True,
    },
]


class Command(BaseCommand):
    help = 'Cria um usuario de cada perfil, com dados de exemplo para navegacao'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help=(
                'Apaga TODOS os vinculos, publicacoes, denuncias e notificacoes '
                'do banco antes de montar a demonstracao, inclusive de contas '
                'que nao sao de exemplo. Use quando o banco de teste acumulou '
                'residuo de execucoes anteriores.'
            ),
        )

    @transaction.atomic
    def handle(self, *args, **opcoes):
        # A turma do primeiro periodo e a base: e o recorte real de quem
        # ingressou agora. Mas o forum precisa de movimento em varias
        # disciplinas, senao o painel da coordenacao mostra uma linha com
        # numero e trinta zeradas, o que nao permite avaliar nada.
        primeiro_periodo = list(
            Disciplina.objects.filter(
                optativa=False, deleted_at__isnull=True, periodo_sugerido=1,
            ).order_by('codigo')
        )
        segundo_periodo = list(
            Disciplina.objects.filter(
                optativa=False, deleted_at__isnull=True, periodo_sugerido=2,
            ).order_by('codigo')
        )

        if len(primeiro_periodo) < 2:
            raise CommandError(
                'Sao necessarias ao menos duas disciplinas de primeiro periodo. '
                'Rode antes:\n'
                '  python manage.py importar_matriz_ppc docs/ppc-cco.txt '
                '--curso CCO --nome "Ciencia da Computacao" --ano 2026'
            )

        # O semestre corrente e par, entao a movimentacao do forum acontece
        # nas disciplinas de segundo periodo, que sao as ofertadas agora.
        base = segundo_periodo or primeiro_periodo
        primeira, segunda = base[0], base[1] if len(base) > 1 else base[0]
        usuarios = self._criar_usuarios()
        self._vincular_coordenacao(usuarios, primeiro_periodo[0].curso)

        if opcoes.get('reset'):
            self._resetar()
        else:
            self._limpar_conteudo_anterior(usuarios)
        self._vincular(usuarios, primeiro_periodo, segundo_periodo)
        self._popular_forum(usuarios, primeira)
        # A movimentacao acontece so nas quatro disciplinas em que ha alunos
        # matriculados, senao o forum exibiria discussao em turma inexistente.
        self._popular_varias_disciplinas(usuarios, base[:-1][:3])
        self._popular_voluntariado(usuarios)

        self._resumir(usuarios, primeira, segunda)

    # ===== Usuarios =====

    def _criar_usuarios(self):
        usuarios = {}

        for perfil in PERFIS:
            usuario = Usuario.objects.filter(cpf=perfil['cpf']).first()

            if usuario is None:
                usuario = Usuario.objects.create_user(
                    cpf=perfil['cpf'],
                    email=perfil['email'],
                    nome_completo=perfil['nome'],
                    password=SENHA,
                )

            usuario.nome_completo = perfil['nome']
            usuario.email = perfil['email']
            usuario.matricula = perfil['matricula']
            usuario.genero = perfil['genero']
            usuario.is_admin = perfil['admin']
            usuario.ativo = True
            usuario.set_password(SENHA)
            usuario.save()

            if perfil.get('ong'):
                RoleGlobal.objects.get_or_create(usuario=usuario, role='ong')

                # Sem responsavel cadastrado, o certificado sai sem quem o
                # assine. A organizacao demo ja nasce com esse dado.
                usuario.nome_responsavel = 'Marina Teixeira'
                usuario.cargo_responsavel = 'Coordenadora de Voluntariado'
                usuario.save(update_fields=['nome_responsavel', 'cargo_responsavel'])

            usuarios[perfil['chave']] = usuario

        return usuarios

    def _resetar(self):
        """
        Zera o conteudo do forum e os vinculos de disciplina.

        Diferente da limpeza normal, apaga tudo e nao apenas o que pertence
        aos perfis de exemplo. Existe porque o banco de desenvolvimento
        acumulou residuo de versoes anteriores do roteiro, e nesse estado nao
        da para avaliar nenhuma tela: os numeros nunca batem.

        Nao mexe em usuarios, cursos nem disciplinas.
        """
        from notificacoes.models import Notificacao

        AlertaConteudo.objects.all().delete()
        Notificacao.objects.all().delete()

        posts, _ = Post.objects.all().delete()
        vinculos, _ = PermissaoDisciplina.objects.all().delete()

        self.stdout.write(self.style.WARNING(
            f'Reset aplicado: {posts} publicacao(oes) e {vinculos} vinculo(s) '
            f'removidos de todo o banco.'
        ))

    def _limpar_conteudo_anterior(self, usuarios):
        """
        Desfaz a demonstracao anterior antes de montar a nova.

        Remove publicacoes e vinculos de disciplina dos usuarios de exemplo.
        Os vinculos precisam sair porque o comando os cria com
        update_or_create: sem a limpeza, cada execucao somava disciplinas as
        anteriores, e o professor terminava com oito materias quando o roteiro
        previa tres. So toca no que pertence aos perfis de demonstracao.
        """
        pessoas = list(usuarios.values())

        AlertaConteudo.objects.filter(post__autor__in=pessoas).delete()

        removidos, _ = Post.objects.filter(autor__in=pessoas).delete()
        if removidos:
            self.stdout.write(f'{removidos} publicacao(oes) anterior(es) removida(s).')

        vinculos, _ = PermissaoDisciplina.objects.filter(usuario__in=pessoas).delete()
        if vinculos:
            self.stdout.write(f'{vinculos} vinculo(s) anterior(es) removido(s).')

    def _vincular_coordenacao(self, usuarios, curso):
        """Amarra a coordenacao ao curso que ela responde."""
        if curso is None:
            return

        usuarios['coordenacao'].curso_coordenado = curso
        usuarios['coordenacao'].save(update_fields=['curso_coordenado'])

    def _vincular(self, usuarios, primeiro_periodo, segundo_periodo):
        """
        Distribui os papeis pelas disciplinas dos dois primeiros periodos.

        A monitora e monitora na primeira disciplina e aluna nas demais,
        porque e assim na pratica: o monitor continua sendo estudante, e a
        interface precisa lidar com esse acumulo.

        O professor nao recebe todas as disciplinas de proposito. A ultima de
        cada periodo fica sem responsavel, para que o painel da coordenacao
        tenha o que sinalizar como pendente.
        """
        # Tres disciplinas ativas, as mesmas para os tres perfis. Manter o
        # mesmo conjunto e proposital: assim da para comparar como cada papel
        # enxerga exatamente a mesma turma. Quem ve o curso inteiro e apenas a
        # coordenacao, no painel dela.
        ativas = segundo_periodo[:3]
        vinculos = []

        for indice, disciplina in enumerate(ativas):
            vinculos.append((usuarios['professor'], disciplina, 'professor'))
            vinculos.append((usuarios['aluno'], disciplina, 'aluno'))
            vinculos.append((usuarios['aluno2'], disciplina, 'aluno'))

            # A monitora monitora duas e cursa a terceira como aluna, que e o
            # caso real: ela continua sendo estudante nas proprias materias.
            vinculos.append((
                usuarios['monitor'],
                disciplina,
                'monitor' if indice < 2 else 'aluno',
            ))

        for usuario, disciplina, papel in vinculos:
            PermissaoDisciplina.objects.update_or_create(
                usuario=usuario,
                disciplina=disciplina,
                defaults={'papel': papel, 'ativo': True},
            )

        self.stdout.write(
            'Disciplinas ativas: '
            + ', '.join(disciplina.codigo for disciplina in ativas)
        )

    # ===== Conteudo de exemplo =====

    def _popular_forum(self, usuarios, disciplina):
        topico, _ = Post.objects.get_or_create(
            disciplina=disciplina,
            autor=usuarios['aluno'],
            titulo='Por que a solução usa laço duplo se a complexidade é linear?',
            defaults={
                'conteudo': (
                    'O enunciado pede algoritmo em O(n), mas a solução do gabarito '
                    'tem um for dentro do outro. Isso não seria O(n²)?'
                ),
            },
        )

        Post.objects.get_or_create(
            disciplina=disciplina,
            autor=usuarios['monitor'],
            post_pai=topico,
            defaults={
                'conteudo': (
                    'O laço interno percorre sempre 26 posições, uma para cada letra '
                    'do alfabeto, e não depende do tamanho da entrada. Como esse '
                    'número é constante, ele sai da análise assintótica e sobra O(n). '
                    'Laço aninhado só multiplica a complexidade quando os dois '
                    'crescem com a entrada.'
                ),
                'e_melhor': True,
            },
        )

        # Post denunciado, para que a fila de moderacao tenha o que mostrar.
        inadequado, _ = Post.objects.get_or_create(
            disciplina=disciplina,
            autor=usuarios['aluno'],
            titulo='Alguém tem a prova aplicada no semestre passado?',
            defaults={
                'conteudo': (
                    'Se alguém tiver a prova do semestre anterior salva, poderia '
                    'compartilhar aqui no fórum? Ajudaria muito a estudar.'
                ),
            },
        )

        AlertaConteudo.objects.get_or_create(
            denunciante=usuarios['monitor'],
            post=inadequado,
            defaults={
                'motivo': (
                    'Pedido de compartilhamento de prova aplicada, que é material '
                    'de avaliação de uso restrito ao docente.'
                ),
            },
        )

        criar_notificacao(
            destinatario=usuarios['aluno'],
            tipo='melhor_resposta',
            titulo='Sua dúvida foi respondida',
            mensagem=(
                'A monitoria respondeu sua dúvida sobre complexidade de laços '
                'aninhados e a resposta foi marcada como a melhor.'
            ),
            remetente=usuarios['monitor'],
            objeto_relacionado=disciplina,
        )

    def _popular_varias_disciplinas(self, usuarios, disciplinas):
        """
        Espalha discussao pelas disciplinas, com situacoes diferentes.

        A variacao e o ponto: uma disciplina com duvida respondida rapido,
        outra com duvida parada ha dias, outra sem movimento nenhum. E isso
        que faz o painel da coordenacao dizer alguma coisa, porque o indicador
        de espera media so tem sentido quando ha contraste entre as linhas.
        """
        agora = timezone.now()

        # Cada entrada e uma conversa completa: a resposta trata do que foi
        # perguntado. Texto generico deixa a demonstracao artificial e nao
        # permite avaliar se o forum cumpre o proposito.
        roteiro = [
            (
                2,
                'Diferença entre passagem por valor e por referência em C',
                'Quando passo um vetor para uma função e altero dentro dela, a '
                'mudança permanece depois. Mas com uma variável int isso não '
                'acontece. Por que os dois casos se comportam diferente?',
                'Porque em C o nome do vetor decai para um ponteiro ao primeiro '
                'elemento, então a função recebe o endereço e escreve na memória '
                'original. Com o int você recebe uma cópia do valor, e alterar a '
                'cópia não afeta o original. Se quiser o mesmo efeito com int, '
                'passe &variavel e receba como int*.',
                3,
            ),
            (
                5,
                'Por que meu laço de repetição executa uma vez a mais?',
                'Escrevi for (i = 0; i <= n; i++) para percorrer um vetor de n '
                'posições e o programa acessa uma posição inválida no fim.',
                'O vetor de n posições vai do índice 0 ao n-1, então o teste tem '
                'de ser i < n. Com i <= n você entra uma vez a mais e acessa '
                'memória fora do vetor, o que às vezes nem dá erro, apenas lê lixo. '
                'Esse deslocamento de um é tão comum que tem nome: erro de off-by-one.',
                20,
            ),
            (
                9,
                'Como saber se um algoritmo é O(n) ou O(n log n)?',
                'Consigo calcular a complexidade quando o código tem laços '
                'aninhados, mas travo quando aparece recursão que divide a entrada '
                'ao meio.',
                # Sem resposta de proposito: e o caso que o painel do professor
                # precisa sinalizar como pendente.
                None,
                None,
            ),
            (
                1,
                'A prova cobra demonstração ou só aplicação?',
                'Vi nos exercícios que algumas questões pedem para provar a '
                'propriedade e outras só para aplicar a fórmula. Queria saber o que '
                'esperar na avaliação.',
                'A avaliação cobra os dois, com peso maior na aplicação. As '
                'demonstrações pedidas são as que fizemos em aula, então vale '
                'refazer as três do material sem olhar a resposta antes.',
                6,
            ),
            (
                14,
                'Erro de segmentação ao liberar memória',
                'Uso free() no fim da função e o programa quebra. Se eu tirar o '
                'free ele roda, mas imagino que fique errado do mesmo jeito.',
                None,
                None,
            ),
            (
                4,
                'Qual a diferença entre pilha e fila na prática?',
                'Entendi que uma é LIFO e a outra FIFO, mas não consigo pensar em '
                'quando escolher uma ou outra num problema real.',
                'Pense no que você precisa recuperar primeiro. Desfazer ações num '
                'editor pede pilha, porque o último comando é o primeiro a ser '
                'desfeito. Atendimento por ordem de chegada pede fila. Quando o '
                'enunciado fala em voltar atrás, costuma ser pilha; quando fala em '
                'ordem de chegada, fila.',
                2,
            ),
        ]

        criados = 0

        for indice, disciplina in enumerate(disciplinas):
            # Uma em cada quatro fica sem movimento, para haver contraste.
            if indice % 4 == 3:
                continue

            dias, titulo, conteudo, resposta_texto, horas_resposta = roteiro[
                indice % len(roteiro)
            ]
            publicado_em = agora - timedelta(days=dias)

            topico, novo = Post.objects.get_or_create(
                disciplina=disciplina,
                autor=usuarios['aluno'],
                titulo=titulo,
                defaults={'conteudo': conteudo},
            )

            if not novo:
                continue

            criados += 1

            # created_at tem auto_now_add, entao a data precisa ser corrigida
            # por update, que nao passa pelo save do model.
            Post.objects.filter(pk=topico.pk).update(created_at=publicado_em)

            if horas_resposta is None:
                continue

            respondente = (
                usuarios['monitor'] if indice % 2 == 0 else usuarios['professor']
            )
            resposta = Post.objects.create(
                disciplina=disciplina,
                autor=respondente,
                post_pai=topico,
                conteudo=resposta_texto,
                e_melhor=indice % 3 == 0,
            )
            Post.objects.filter(pk=resposta.pk).update(
                created_at=publicado_em + timedelta(hours=horas_resposta)
            )

        self.stdout.write(f'{criados} topico(s) de exemplo distribuidos pelas disciplinas.')

    def _popular_voluntariado(self, usuarios):
        hoje = timezone.now().date()

        Oportunidade.objects.get_or_create(
            organizacao=usuarios['organizacao'],
            titulo='Oficina de lógica para o ensino médio',
            defaults={
                'descricao': (
                    'Acompanhamento de estudantes da rede pública em oficinas '
                    'semanais de raciocínio lógico e introdução à programação.'
                ),
                'area': 'educacao',
                'local': 'Itajubá - MG',
                'vagas': 5,
                'carga_horaria_total': 40,
                'data_inicio': hoje + timedelta(days=15),
                'data_fim': hoje + timedelta(days=105),
                'prazo_inscricao': hoje + timedelta(days=10),
                'requer_aprovacao': True,
            },
        )

    # ===== Saida =====

    def _resumir(self, usuarios, primeira, segunda):
        self.stdout.write(self.style.SUCCESS('\nPerfis criados. Senha de todos: ' + SENHA))
        self.stdout.write(f'Disciplinas usadas: {primeira.codigo} e {segunda.codigo}\n')

        descricoes = {
            'coordenacao': 've tudo, incluindo moderacao de todas as disciplinas',
            'professor': 'professor nas disciplinas do 1o e 2o periodos, menos a ultima de cada',
            'monitor': 'monitora em duas disciplinas e aluna em outras duas',
            'aluno': 'matriculado nas tres disciplinas ativas do semestre',
            'aluno2': 'matriculada nas mesmas tres, para testar grupo e chat',
            'organizacao': 'publica oportunidades de voluntariado',
        }

        for chave, usuario in usuarios.items():
            self.stdout.write(
                f'  {chave:<12} CPF {usuario.cpf}   {usuario.nome_completo:<22} '
                f'{descricoes[chave]}'
            )
