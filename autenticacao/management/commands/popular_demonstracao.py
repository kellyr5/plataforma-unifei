"""
Popula a plataforma com um semestre plausivel de uso.

Uso:
    python manage.py criar_perfis_demo --reset
    python manage.py popular_demonstracao

Por que existe
--------------
O comando criar_perfis_demo monta uma conta de cada perfil e o minimo de
conteudo para as telas nao aparecerem vazias. Serve para conferir interface,
mas nao sustenta a tese do trabalho.

A plataforma promete acompanhamento pedagogico: a coordenacao olha o curso e
identifica onde a discussao travou. Com cinco publicacoes em tres disciplinas,
o painel exibe uma linha com numero e as demais zeradas, e o indicador de
tempo medio de resposta nao significa nada — media sobre um caso nao e media.
Contraste entre as disciplinas e o que torna o indicador legivel, e contraste
precisa de volume.

Este comando produz esse volume com intencao. As disciplinas nao recebem o
mesmo tratamento: algumas sao ativas e respondem rapido, outras acumulam
duvida sem resposta, uma fica silenciosa. E esse desenho que faz o painel
dizer alguma coisa quando alguem o abre pela primeira vez.

O sorteio usa semente fixa: rodar duas vezes produz o mesmo banco, e uma
demonstracao que muda a cada execucao nao pode ser preparada com antecedencia.
"""

import random
import unicodedata
from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from autenticacao.models import RoleGlobal, Usuario
from forum.models import Disciplina, PermissaoDisciplina, Post
from voluntariado.models import InscricaoVoluntariado, Oportunidade


def _sem_acento(texto: str) -> str:
    """
    Remove acentuacao, para compor endereco de e-mail.

    Nome proprio brasileiro costuma ter acento, e endereco de e-mail com
    caractere acentuado e recusado por boa parte dos servidores. O nome
    exibido na plataforma continua acentuado; so o endereco e simplificado.
    """
    normalizado = unicodedata.normalize('NFKD', texto)
    return ''.join(c for c in normalizado if not unicodedata.combining(c))


SEMENTE = 20262
SENHA = 'Demo2026.'

# Nomes brasileiros comuns, combinados para formar a turma. Preferimos compor
# a partir de listas a fixar trinta nomes inteiros: a combinacao produz
# variedade suficiente e mantem o arquivo legivel.
PRIMEIROS = [
    ('f', 'Ana'), ('f', 'Beatriz'), ('f', 'Camila'), ('f', 'Daniela'),
    ('f', 'Eduarda'), ('f', 'Fernanda'), ('f', 'Gabriela'), ('f', 'Helena'),
    ('f', 'Isabela'), ('f', 'Juliana'), ('f', 'Larissa'), ('f', 'Mariana'),
    ('m', 'André'), ('m', 'Bruno'), ('m', 'Caio'), ('m', 'Diego'),
    ('m', 'Eduardo'), ('m', 'Felipe'), ('m', 'Gustavo'), ('m', 'Henrique'),
    ('m', 'Igor'), ('m', 'João'), ('m', 'Lucas'), ('m', 'Matheus'),
    ('m', 'Nicolas'), ('m', 'Otávio'), ('m', 'Pedro'), ('m', 'Rafael'),
    ('m', 'Thiago'), ('m', 'Vinícius'),
]

SOBRENOMES = [
    'Almeida', 'Barbosa', 'Cardoso', 'Duarte', 'Esteves', 'Ferreira',
    'Gonçalves', 'Ham', 'Iglesias', 'Junqueira', 'Lima', 'Machado',
    'Nogueira', 'Oliveira', 'Pereira', 'Queiroz', 'Ribeiro', 'Santos',
    'Teixeira', 'Vasconcelos',
]


# ============================================================================
# Conteudo do forum
#
# As perguntas sao especificas da disciplina em que entram. Texto generico
# ("duvida sobre a materia") tornaria a demonstracao artificial e nao
# permitiria avaliar se o forum cumpre o proposito de registrar conhecimento.
# ============================================================================
DUVIDAS = {
    'CTCO01': [
        (
            'Lista encadeada ou vetor para inserção no meio?',
            'Preciso inserir elementos no meio da estrutura com frequência. '
            'Vetor me obriga a deslocar tudo à direita. Lista encadeada resolve, '
            'mas perco o acesso por índice. Como decidir?',
            'Depende de qual operação domina o seu uso. Se insere no meio com '
            'frequência e percorre sequencialmente, a lista ganha: a inserção é '
            'O(1) depois de achar a posição. Se acessa por índice o tempo todo, '
            'o vetor ganha, mesmo pagando o deslocamento. Conte as operações do '
            'seu caso antes de escolher.',
        ),
        (
            'Por que a recursão da fatorial estoura a pilha com n grande?',
            'Testei fatorial(50000) e o programa quebrou com stack overflow. '
            'Com n pequeno funciona normal.',
            'Cada chamada recursiva empilha um quadro com os parâmetros e o '
            'endereço de retorno, e a pilha tem tamanho fixo. Com 50 mil '
            'chamadas aninhadas você esgota esse espaço antes de chegar ao caso '
            'base. A versão iterativa usa um quadro só. Algumas linguagens '
            'otimizam recursão de cauda, mas C não garante isso.',
        ),
        (
            'Qual a diferença entre ponteiro nulo e ponteiro não inicializado?',
            'Os dois parecem dar problema quando eu tento acessar.',
            None,
        ),
        (
            'Complexidade de busca binária em lista encadeada',
            'A busca binária é O(log n) no vetor. Se eu implementar em lista '
            'encadeada, continua O(log n)?',
            'Não. A busca binária depende de acesso direto ao elemento do meio, '
            'que no vetor é O(1). Na lista você precisa percorrer até o meio, e '
            'isso é O(n) a cada passo — o total vira O(n log n), pior que a '
            'busca linear simples. É um bom exemplo de que a complexidade de um '
            'algoritmo depende da estrutura que está por baixo.',
        ),
    ],
    'CRSC04': [
        (
            'Por que o pipeline precisa de bolhas?',
            'Entendi que o pipeline sobrepõe instruções, mas não entendi por que '
            'às vezes o processador insere ciclos vazios.',
            'Porque uma instrução pode depender do resultado de outra que ainda '
            'não terminou. Se a instrução 2 lê um registrador que a instrução 1 '
            'ainda vai escrever, ela precisa esperar — é o hazard de dados. A '
            'bolha é essa espera. Adiantamento de operandos resolve boa parte '
            'dos casos sem parar o pipeline.',
        ),
        (
            'Cache: por que associatividade maior nem sempre é melhor?',
            'Se aumentar a associatividade reduz conflito, por que não usar '
            'totalmente associativa sempre?',
            'Porque a busca passa a comparar a etiqueta com todas as vias ao '
            'mesmo tempo, e isso custa área, energia e tempo de acesso. A cache '
            'fica mais lenta em todos os acessos para evitar conflitos que '
            'ocorrem em alguns. Na prática, 4 ou 8 vias já eliminam quase todo o '
            'conflito com custo aceitável.',
        ),
        (
            'Diferença prática entre RISC e CISC hoje',
            'Li que a distinção perdeu sentido porque processadores CISC '
            'traduzem para micro-operações internamente. Ainda faz diferença?',
            None,
        ),
    ],
    'CMAC04': [
        (
            'Quando o método de Euler não serve?',
            'Implementei Euler para uma equação diferencial e o resultado diverge '
            'do esperado conforme o tempo avança.',
            'Euler acumula erro a cada passo, e em sistemas rígidos esse acúmulo '
            'explode. Reduzir o passo ajuda até certo ponto e depois o erro de '
            'arredondamento passa a dominar. Runge-Kutta de quarta ordem custa '
            'mais por passo, mas o erro cresce muito mais devagar — geralmente '
            'compensa.',
        ),
        (
            'Como validar se meu modelo representa o fenômeno?',
            'Consigo implementar o modelo e gerar números. Não sei dizer se os '
            'números descrevem alguma coisa real.',
            'Separe os dados: ajuste o modelo com uma parte e teste com outra que '
            'ele não viu. Depois verifique se o comportamento nos extremos faz '
            'sentido físico — modelo que prevê população negativa está errado, '
            'por melhor que seja o ajuste. Um bom ajuste numérico com '
            'comportamento absurdo é sinal de sobreajuste.',
        ),
        (
            'Erro de arredondamento em ponto flutuante',
            'Somei 0.1 dez vezes e não deu 1.0 exatamente. Isso é bug da '
            'linguagem?',
            'Não é bug: 0.1 não tem representação exata em binário, do mesmo '
            'jeito que 1/3 não tem em decimal. Cada soma acumula um erro '
            'minúsculo. Para comparar dois flutuantes, teste se a diferença é '
            'menor que uma tolerância em vez de usar igualdade.',
        ),
        (
            'Qual a diferença entre interpolação e regressão?',
            'As duas passam uma curva pelos pontos. Não vejo a distinção.',
            None,
        ),
    ],
}

# Duvidas genericas, usadas nas demais disciplinas do semestre para que o
# painel tenha linhas com movimento variado.
DUVIDAS_GERAIS = [
    (
        'Bibliografia da prova sai só do material de aula?',
        'Queria saber se preciso ler os capítulos indicados ou se o material '
        'apresentado em aula cobre a avaliação.',
        'O material de aula cobre o que é cobrado, mas a bibliografia traz os '
        'exemplos resolvidos com mais detalhe. Para quem ficou com dúvida em '
        'algum tópico, vale ler o capítulo correspondente.',
    ),
    (
        'Trabalho pode ser feito em dupla?',
        'O enunciado não diz nada sobre número de integrantes.',
        'Pode, em dupla ou individual. Se for em dupla, os dois entregam o mesmo '
        'documento e ambos precisam saber explicar qualquer parte.',
    ),
    (
        'Não consegui reproduzir o resultado do exemplo da aula',
        'Segui o mesmo passo a passo e cheguei a um valor diferente do slide.',
        None,
    ),
]


class Command(BaseCommand):
    help = 'Popula a plataforma com um semestre plausivel de uso'

    def add_arguments(self, parser):
        parser.add_argument(
            '--estudantes',
            type=int,
            default=28,
            help='Quantos estudantes criar (padrao: 28).',
        )
        parser.add_argument(
            '--sem-imagens',
            action='store_true',
            help='Nao gera as imagens de capa das oportunidades.',
        )

    @transaction.atomic
    def handle(self, *args, **opcoes):
        self.aleatorio = random.Random(SEMENTE)
        self.agora = timezone.now()

        disciplinas = self._disciplinas_do_semestre()

        if not disciplinas:
            raise CommandError(
                'Nenhuma disciplina encontrada. Rode antes:\n'
                '  python manage.py importar_matriz_ppc docs/ppc-cco.txt '
                '--curso CCO --nome "Ciencia da Computacao" --ano 2026'
            )

        professores = self._garantir_professores(disciplinas)
        estudantes = self._criar_estudantes(opcoes['estudantes'], disciplinas)

        self.stdout.write(
            f'{len(estudantes)} estudante(s) e {len(professores)} docente(s) '
            f'distribuidos em {len(disciplinas)} disciplina(s).'
        )

        publicacoes = self._popular_forum(disciplinas, estudantes, professores)
        self.stdout.write(f'{publicacoes} publicacao(oes) criada(s) no forum.')

        vagas = self._popular_voluntariado(
            estudantes, gerar_imagens=not opcoes['sem_imagens'],
        )
        self.stdout.write(f'{vagas} oportunidade(s) de voluntariado.')

        self._resumir(disciplinas)

    # ===== Base =====

    def _disciplinas_do_semestre(self):
        """
        Disciplinas ofertadas agora, pela paridade do periodo.

        Periodo impar e ofertado no primeiro semestre; par, no segundo. Popular
        disciplina fora de oferta produziria discussao numa turma que nao
        existe neste momento.
        """
        resto = 1 if self.agora.month <= 7 else 0

        return [
            disciplina
            for disciplina in Disciplina.objects.filter(
                optativa=False, deleted_at__isnull=True,
            ).order_by('periodo_sugerido', 'codigo')
            if disciplina.periodo_sugerido
            and disciplina.periodo_sugerido % 2 == resto
        ]

    def _proximo_cpf(self, indice):
        """CPF de demonstracao, na faixa 900... para nao colidir com os perfis."""
        return f'9{indice:010d}'

    def _criar_usuario(self, cpf, nome, email, genero, matricula=''):
        usuario = Usuario.objects.filter(cpf=cpf).first()

        if usuario is None:
            usuario = Usuario.objects.create_user(
                cpf=cpf, email=email, nome_completo=nome, password=SENHA,
            )

        usuario.nome_completo = nome
        usuario.email = email
        usuario.genero = genero
        usuario.matricula = matricula
        usuario.ativo = True
        usuario.save()

        return usuario

    def _garantir_professores(self, disciplinas):
        """
        Um docente por disciplina, com algumas sem responsavel.

        A ausencia e proposital: o painel da coordenacao precisa ter o que
        sinalizar como pendencia de alocacao, e uma grade toda preenchida nao
        exercita esse caminho.
        """
        # Nomes ficticios, deliberadamente.
        #
        # A lista anterior trazia docentes reais do curso, extraidos do projeto
        # pedagogico. Numa base de demonstracao isso associa pessoas
        # identificaveis a publicacoes, respostas e ritmos de atendimento que
        # elas nunca produziram — e a plataforma esta publica. Um docente que
        # abrisse a tela encontraria o proprio nome ao lado de comportamento
        # inventado, sem nunca ter sido consultado.
        #
        # Os sobrenomes foram escolhidos para nao coincidir com o quadro do
        # Instituto de Matematica e Computacao.
        nomes = [
            ('m', 'Otávio Bernardes Fontoura'), ('f', 'Solange Vieira Tavares'),
            ('m', 'Idalécio Marques Rebouças'), ('f', 'Neusa Portela Camargo'),
            ('m', 'Waldemar Assunção Vilela'), ('f', 'Cremilda Rangel Duarte'),
            ('m', 'Osmar Teixeira Bicalho'), ('f', 'Marlene Quadros Antunes'),
        ]

        professores = []

        for indice, disciplina in enumerate(disciplinas):
            # Uma em cada cinco fica sem responsavel alocado.
            if indice % 5 == 4:
                continue

            genero, nome = nomes[indice % len(nomes)]
            cpf = self._proximo_cpf(100 + (indice % len(nomes)))
            primeiro = _sem_acento(nome.split()[0]).lower()

            docente = self._criar_usuario(
                cpf=cpf,
                nome=nome,
                email=f'{primeiro}.demo@unifei.edu.br',
                genero=genero,
                matricula=f'D20{10 + (indice % len(nomes))}00{indice % 9}',
            )

            PermissaoDisciplina.objects.update_or_create(
                usuario=docente, disciplina=disciplina,
                defaults={'papel': 'professor', 'ativo': True},
            )

            if docente not in professores:
                professores.append(docente)

        return professores

    def _criar_estudantes(self, quantidade, disciplinas):
        """
        Cria a turma e matricula cada estudante em quatro a seis disciplinas.

        A matricula nao e uniforme de proposito: turmas reais tem tamanhos
        diferentes, e um painel em que toda disciplina tem exatamente o mesmo
        numero de alunos denuncia dado fabricado.
        """
        estudantes = []

        for indice in range(quantidade):
            genero, primeiro = PRIMEIROS[indice % len(PRIMEIROS)]
            sobrenome = SOBRENOMES[(indice * 7) % len(SOBRENOMES)]
            segundo = SOBRENOMES[(indice * 13 + 3) % len(SOBRENOMES)]
            nome = f'{primeiro} {sobrenome} {segundo}'

            matricula = f'20{22 + indice % 4}0{indice:05d}'

            estudante = self._criar_usuario(
                cpf=self._proximo_cpf(200 + indice),
                nome=nome,
                email=f'{matricula}@unifei.edu.br',
                genero=genero,
                matricula=matricula,
            )

            quantas = self.aleatorio.randint(4, min(6, len(disciplinas)))
            for disciplina in self.aleatorio.sample(disciplinas, quantas):
                PermissaoDisciplina.objects.get_or_create(
                    usuario=estudante, disciplina=disciplina,
                    defaults={'papel': 'aluno', 'ativo': True},
                )

            estudantes.append(estudante)

        # Alguns monitores, escolhidos entre os proprios estudantes, como
        # acontece na universidade. Um por disciplina: a monitoria e encargo
        # unico por turma.
        for disciplina in disciplinas[:3]:
            # Disciplina que ja tem monitor nao ganha outro. Sem esta
            # verificacao, cada execucao do comando somava um monitor as
            # mesmas tres disciplinas, e o canal da monitoria acumulava gente
            # que nunca exerceu o papel junta.
            ja_tem = PermissaoDisciplina.objects.filter(
                disciplina=disciplina, papel='monitor', ativo=True,
            ).exists()

            if ja_tem:
                continue

            candidatos = [
                v.usuario for v in PermissaoDisciplina.objects.filter(
                    disciplina=disciplina, papel='aluno', ativo=True,
                ).select_related('usuario')[:5]
            ]

            if not candidatos:
                continue

            monitor = self.aleatorio.choice(candidatos)
            PermissaoDisciplina.objects.filter(
                usuario=monitor, disciplina=disciplina,
            ).update(papel='monitor')

        return estudantes

    # ===== Forum =====

    def _matriculados(self, disciplina):
        return [
            v.usuario for v in PermissaoDisciplina.objects.filter(
                disciplina=disciplina, papel__in=['aluno', 'monitor'], ativo=True,
            ).select_related('usuario')
        ]

    def _responsavel(self, disciplina):
        vinculo = PermissaoDisciplina.objects.filter(
            disciplina=disciplina, papel__in=['professor', 'monitor'], ativo=True,
        ).select_related('usuario').first()

        return vinculo.usuario if vinculo else None

    def _popular_forum(self, disciplinas, estudantes, professores):
        """
        Distribui a discussao com ritmos diferentes entre as disciplinas.

        O desenho e o ponto. Uma disciplina em que tudo se responde em duas
        horas e outra em que a duvida fica cinco dias parada produzem, no
        painel da coordenacao, a diferenca que permite dizer onde intervir.
        Se todas se comportassem igual, o indicador nao teria o que revelar.
        """
        criadas = 0

        for indice, disciplina in enumerate(disciplinas):
            turma = self._matriculados(disciplina)
            respondente = self._responsavel(disciplina)

            if not turma:
                continue

            # Perfil da disciplina, ciclico:
            #   0  ativa e rapida
            #   1  ativa e lenta
            #   2  movimento moderado
            #   3  silenciosa
            perfil = indice % 4

            if perfil == 3:
                continue

            roteiro = DUVIDAS.get(disciplina.codigo, DUVIDAS_GERAIS)
            quantos = {0: len(roteiro), 1: max(2, len(roteiro) - 1), 2: 2}[perfil]

            for ordem, (titulo, conteudo, resposta) in enumerate(roteiro[:quantos]):
                dias_atras = self.aleatorio.randint(1, 40)
                publicado = self.agora - timedelta(days=dias_atras)

                topico, novo = Post.objects.get_or_create(
                    disciplina=disciplina,
                    autor=self.aleatorio.choice(turma),
                    titulo=titulo,
                    defaults={'conteudo': conteudo},
                )

                if not novo:
                    continue

                criadas += 1
                Post.objects.filter(pk=topico.pk).update(created_at=publicado)

                if resposta is None or respondente is None:
                    continue

                # A espera pela resposta e o que distingue os perfis.
                horas = {
                    0: self.aleatorio.randint(1, 6),
                    1: self.aleatorio.randint(72, 168),
                    2: self.aleatorio.randint(12, 48),
                }[perfil]

                filho = Post.objects.create(
                    disciplina=disciplina,
                    autor=respondente,
                    post_pai=topico,
                    conteudo=resposta,
                    e_melhor=ordem % 2 == 0,
                )
                Post.objects.filter(pk=filho.pk).update(
                    created_at=publicado + timedelta(hours=horas)
                )
                criadas += 1

        return criadas

    # ===== Voluntariado =====

    def _organizacoes(self):
        dados = [
            ('Instituto Semear', 'Marina Teixeira', 'Coordenadora de Voluntariado'),
            ('Casa de Apoio Girassol', 'Paulo Rezende', 'Diretor'),
            ('Coletivo Rio Sapucaí', 'Letícia Andrade', 'Coordenadora de Projetos'),
        ]

        organizacoes = []

        for indice, (nome, responsavel, cargo) in enumerate(dados):
            slug = nome.lower().split()[-1]

            organizacao = self._criar_usuario(
                cpf=self._proximo_cpf(500 + indice),
                nome=nome,
                email=f'{slug}.demo@unifei.edu.br',
                genero='n',
            )

            RoleGlobal.objects.get_or_create(usuario=organizacao, role='ong')

            organizacao.nome_responsavel = responsavel
            organizacao.cargo_responsavel = cargo
            organizacao.save(update_fields=['nome_responsavel', 'cargo_responsavel'])

            organizacoes.append(organizacao)

        return organizacoes

    def _popular_voluntariado(self, estudantes, gerar_imagens=True):
        hoje = self.agora.date()
        organizacoes = self._organizacoes()

        acoes = [
            (
                0, 'Oficina de lógica para o ensino médio', 'educacao',
                'Acompanhamento de estudantes da rede pública em oficinas '
                'semanais de raciocínio lógico e introdução à programação.',
                40, 5, True, -20,
            ),
            (
                0, 'Monitoria de matemática para o ENEM', 'educacao',
                'Plantão semanal de dúvidas de matemática para candidatos do '
                'ENEM, em parceria com escolas estaduais de Itajubá.',
                60, 8, True, -8,
            ),
            (
                1, 'Inclusão digital para pessoas idosas', 'tecnologia',
                'Oficinas de uso de celular, aplicativos bancários e serviços '
                'públicos digitais para pessoas acima de 60 anos.',
                30, 6, False, 5,
            ),
            (
                1, 'Apoio na triagem do banco de alimentos', 'assistencia_social',
                'Organização, conferência e separação de doações recebidas pelo '
                'banco de alimentos municipal.',
                24, 12, False, 12,
            ),
            (
                2, 'Mutirão de limpeza das margens do Sapucaí', 'meio_ambiente',
                'Ação de retirada de resíduos das margens do rio, com registro '
                'fotográfico e levantamento dos pontos críticos.',
                16, 20, False, 18,
            ),
        ]

        criadas = 0

        for indice_org, titulo, area, descricao, horas, vagas, aprova, offset in acoes:
            organizacao = organizacoes[indice_org]

            oportunidade, nova = Oportunidade.objects.get_or_create(
                organizacao=organizacao,
                titulo=titulo,
                defaults={
                    'descricao': descricao,
                    'o_que_fazer': descricao,
                    'requisitos': 'Disponibilidade de quatro horas semanais.',
                    'area': area,
                    'local': 'Itajubá - MG',
                    'vagas': vagas,
                    'carga_horaria_total': horas,
                    'data_inicio': hoje + timedelta(days=offset),
                    'data_fim': hoje + timedelta(days=offset + 90),
                    'prazo_inscricao': hoje + timedelta(days=offset - 5),
                    'requer_aprovacao': aprova,
                },
            )

            if nova:
                criadas += 1

            if gerar_imagens and not oportunidade.imagem:
                self._gerar_capa(oportunidade)

            self._inscrever(oportunidade, estudantes)

        return criadas

    def _inscrever(self, oportunidade, estudantes):
        """
        Cria inscricoes em situacoes variadas.

        Ter pendente, aprovada, concluida e recusada na mesma base e o que
        permite conferir a tela da organizacao e a do estudante sem precisar
        encenar cada fluxo a mao antes de mostrar.
        """
        if oportunidade.inscricoes.exists():
            return

        candidatos = self.aleatorio.sample(
            estudantes, min(len(estudantes), oportunidade.vagas)
        )

        ja_passou = oportunidade.data_fim < self.agora.date()

        from voluntariado.services import concluir_inscricao

        for posicao, estudante in enumerate(candidatos):
            if ja_passou:
                situacao = 'concluida'
            elif posicao == 0 and oportunidade.requer_aprovacao:
                situacao = 'pendente'
            elif posicao == 1 and oportunidade.requer_aprovacao:
                situacao = 'rejeitada'
            else:
                situacao = 'aprovada'

            inscricao = InscricaoVoluntariado.objects.create(
                oportunidade=oportunidade,
                estudante=estudante,
                status='aprovada' if situacao == 'concluida' else situacao,
                motivacao='Tenho interesse na área e disponibilidade no período.',
                motivo_decisao=(
                    'Perfil não compatível com o turno da ação.'
                    if situacao == 'rejeitada' else ''
                ),
            )

            # A conclusao passa pelo servico, e nao por atribuicao direta de
            # status: e ele que emite o certificado e gera o PDF. Gravar
            # 'concluida' na mao produziria participacao encerrada sem
            # documento, situacao que nao existe no sistema real.
            if situacao == 'concluida':
                try:
                    concluir_inscricao(
                        inscricao,
                        horas_realizadas=oportunidade.carga_horaria_total,
                        avaliacao_organizacao=(
                            'Participação assídua e comprometida ao longo de '
                            'toda a ação.'
                        ),
                    )
                except Exception as erro:  # noqa: BLE001
                    # A geracao do PDF depende do weasyprint e das fontes do
                    # sistema. Se falhar, a demonstracao segue sem o arquivo.
                    self.stderr.write(
                        f'  certificado de {estudante.nome_completo} '
                        f'nao emitido: {erro}'
                    )

    # ===== Imagens =====

    def _gerar_capa(self, oportunidade):
        """
        Desenha a capa da oportunidade em vez de baixar uma foto.

        A escolha e deliberada. Imagem baixada da internet traz duas
        complicacoes que nao compensam numa demonstracao academica: a questao
        de licenca de uso e a dependencia de rede para reproduzir o ambiente.
        A capa gerada e deterministica, roda offline e usa a paleta da
        instituicao, o que mantem a tela coerente.
        """
        from io import BytesIO

        try:
            from PIL import Image, ImageDraw
        except ImportError:
            return

        from django.core.files.base import ContentFile

        largura, altura = 960, 420

        # Tom derivado do titulo: a mesma acao recebe sempre a mesma capa, e
        # acoes diferentes se distinguem entre si.
        semente = sum(ord(c) for c in oportunidade.titulo)
        base = (0, 51, 100)
        clareza = 0.10 + (semente % 7) * 0.045

        topo = tuple(int(c + (255 - c) * clareza) for c in base)
        fundo = base

        imagem = Image.new('RGB', (largura, altura), fundo)
        desenho = ImageDraw.Draw(imagem)

        # Degrade vertical, linha a linha.
        for y in range(altura):
            proporcao = y / altura
            cor = tuple(
                int(topo[i] + (fundo[i] - topo[i]) * proporcao) for i in range(3)
            )
            desenho.line([(0, y), (largura, y)], fill=cor)

        # Circunferencias concentricas, lembrando a engrenagem da marca sem
        # reproduzi-la — o brasao tem regra de uso e nao se desenha por
        # aproximacao.
        centro = (largura - 190, altura // 2)
        for raio in range(70, 240, 34):
            desenho.ellipse(
                [centro[0] - raio, centro[1] - raio,
                 centro[0] + raio, centro[1] + raio],
                outline=(255, 255, 255, 40), width=2,
            )

        buffer = BytesIO()
        imagem.save(buffer, format='JPEG', quality=88)

        oportunidade.imagem.save(
            f'capa-{oportunidade.id}.jpg',
            ContentFile(buffer.getvalue()),
            save=True,
        )

    # ===== Saida =====

    def _resumir(self, disciplinas):
        self.stdout.write(self.style.SUCCESS(
            f'\nBanco populado. Senha de todas as contas criadas: {SENHA}'
        ))
        self.stdout.write(
            '\nAs disciplinas receberam ritmos diferentes de propósito:\n'
            '  resposta rápida, resposta lenta, movimento moderado e silêncio.\n'
            '  É esse contraste que faz o painel da coordenação apontar\n'
            '  onde vale intervir.\n'
        )

        self.stdout.write('Disciplinas do semestre corrente:')
        for disciplina in disciplinas:
            total = Post.objects.filter(
                disciplina=disciplina, deleted_at__isnull=True,
            ).count()
            matriculados = PermissaoDisciplina.objects.filter(
                disciplina=disciplina, papel='aluno', ativo=True,
            ).count()

            self.stdout.write(
                f'  {disciplina.codigo:<9} {disciplina.nome[:38]:<40} '
                f'{matriculados:>2} aluno(s), {total:>2} publicacao(oes)'
            )
