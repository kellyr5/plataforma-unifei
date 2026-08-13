"""
Models de trabalhos em grupo, conversas e pedidos de ajuda.

O desenho segue as decisoes tomadas com a orientacao:

- O professor cria o trabalho e define as regras. Os grupos podem ser montados
  por ele ou pelos proprios alunos, com um lider por grupo.
- A conversa do grupo e privada aos membros. O professor nao le o chat.
- Quando alguem marca uma mensagem como duvida, apenas essa mensagem e a
  descricao chegam a monitoria e ao professor. E o modelo do Piazza: abre um
  canal com quem ensina sem expor a conversa inteira.
- Disciplina sem monitoria notifica somente o professor, de forma transparente
  para quem pediu ajuda.

A tabela Conversa serve aos tres casos, mudando o tipo: turma inteira, grupo de
trabalho e conversa privada. Foi o que evitou triplicar o codigo de mensagem,
participante e leitura.
"""

import uuid

from django.conf import settings
from django.db import models


class Trabalho(models.Model):
    """
    Atividade em grupo proposta pelo professor numa disciplina.

    Guarda as regras da divisao: quantos grupos, quantas pessoas em cada um,
    prazo e como os grupos se formam. A especificacao pode ser geral, aqui, ou
    especifica de cada grupo, no campo correspondente de GrupoTrabalho.
    """

    FORMACAO_CHOICES = [
        ('professor', 'O professor monta os grupos'),
        ('alunos', 'Os alunos se organizam'),
        ('sorteio', 'Sorteio automatico entre os matriculados'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    disciplina = models.ForeignKey(
        'forum.Disciplina',
        on_delete=models.CASCADE,
        related_name='trabalhos',
    )
    criado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='trabalhos_criados',
    )

    titulo = models.CharField(max_length=255)
    especificacao = models.TextField(
        blank=True,
        default='',
        help_text='Enunciado valido para todos os grupos',
    )

    total_grupos = models.PositiveSmallIntegerField(
        help_text='Quantidade de grupos previstos na turma',
    )
    tamanho_maximo = models.PositiveSmallIntegerField(
        default=5,
        help_text='Maximo de participantes por grupo',
    )
    modo_formacao = models.CharField(
        max_length=15,
        choices=FORMACAO_CHOICES,
        default='alunos',
    )

    prazo_entrega = models.DateField()
    encerrado = models.BooleanField(default=False)

    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'trabalho'
        verbose_name = 'Trabalho em Grupo'
        verbose_name_plural = 'Trabalhos em Grupo'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['disciplina', 'encerrado']),
        ]

    def __str__(self):
        return f'{self.titulo} ({self.disciplina.codigo})'

    @property
    def vagas_totais(self):
        return self.total_grupos * self.tamanho_maximo


class GrupoTrabalho(models.Model):
    """
    Um grupo dentro de um trabalho.

    A especificacao propria existe porque o professor pode dar temas
    diferentes a cada grupo; quando vazia, vale o enunciado do trabalho.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trabalho = models.ForeignKey(
        Trabalho,
        on_delete=models.CASCADE,
        related_name='grupos',
    )

    nome = models.CharField(max_length=120)
    descricao = models.TextField(blank=True, default='')
    especificacao_propria = models.TextField(
        blank=True,
        default='',
        help_text='Tema especifico deste grupo. Vazio significa usar o do trabalho.',
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'grupo_trabalho'
        verbose_name = 'Grupo de Trabalho'
        verbose_name_plural = 'Grupos de Trabalho'
        ordering = ['nome']
        constraints = [
            models.UniqueConstraint(
                fields=['trabalho', 'nome'],
                name='unique_grupo_nome_por_trabalho',
            ),
        ]

    def __str__(self):
        return f'{self.nome} - {self.trabalho.titulo}'

    @property
    def esta_cheio(self):
        return self.membros.count() >= self.trabalho.tamanho_maximo


class MembroGrupo(models.Model):
    """
    Participacao de um estudante em um grupo.

    O limite de participantes e regra de backend, e nao constraint, pelo mesmo
    motivo do e_melhor no forum: depende de um valor guardado no trabalho, que
    o banco nao consegue consultar numa restricao de unicidade.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    grupo = models.ForeignKey(
        GrupoTrabalho,
        on_delete=models.CASCADE,
        related_name='membros',
    )
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='grupos_trabalho',
    )
    e_lider = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'membro_grupo'
        verbose_name = 'Membro de Grupo'
        verbose_name_plural = 'Membros de Grupo'
        constraints = [
            models.UniqueConstraint(
                fields=['grupo', 'usuario'],
                name='unique_membro_por_grupo',
            ),
        ]

    def __str__(self):
        return f'{self.usuario.nome_completo} em {self.grupo.nome}'


class Conversa(models.Model):
    """
    Espaco de mensagens, em tres formatos.

    A turma inteira, um grupo de trabalho ou uma conversa privada entre duas
    pessoas. O tipo define quem entra, e o resto do comportamento e o mesmo,
    o que evita triplicar mensagem, participante e controle de leitura.

    O arquivamento no fim do semestre deixa a conversa somente leitura, sem
    apagar nada: o material continua acessivel a quem participou.
    """

    TIPO_CHOICES = [
        ('disciplina', 'Turma da disciplina'),
        ('grupo', 'Grupo de trabalho'),
        ('privada', 'Conversa privada'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tipo = models.CharField(max_length=12, choices=TIPO_CHOICES, db_index=True)

    disciplina = models.ForeignKey(
        'forum.Disciplina',
        on_delete=models.CASCADE,
        related_name='conversas',
        null=True,
        blank=True,
        help_text='Preenchido nas conversas de turma e de grupo',
    )
    grupo = models.OneToOneField(
        GrupoTrabalho,
        on_delete=models.CASCADE,
        related_name='conversa',
        null=True,
        blank=True,
    )

    titulo = models.CharField(max_length=160, blank=True, default='')
    semestre = models.CharField(max_length=10, blank=True, default='')

    arquivada_em = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Preenchido no encerramento do semestre; torna a conversa somente leitura',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'conversa'
        verbose_name = 'Conversa'
        verbose_name_plural = 'Conversas'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tipo', 'disciplina']),
        ]

    def __str__(self):
        return self.titulo or f'{self.get_tipo_display()} ({self.id})'

    @property
    def somente_leitura(self):
        return self.arquivada_em is not None


class ParticipanteConversa(models.Model):
    """
    Quem participa da conversa e ate onde leu.

    O marcador de leitura fica aqui, e nao na mensagem, porque o custo cresce
    com o numero de participantes e nao com o de mensagens: guardar um registro
    de leitura por mensagem e por pessoa inviabilizaria qualquer conversa ativa.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversa = models.ForeignKey(
        Conversa,
        on_delete=models.CASCADE,
        related_name='participantes',
    )
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='conversas',
    )

    lido_ate = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Momento da ultima mensagem lida por esta pessoa',
    )
    silenciada = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'participante_conversa'
        verbose_name = 'Participante de Conversa'
        verbose_name_plural = 'Participantes de Conversa'
        constraints = [
            models.UniqueConstraint(
                fields=['conversa', 'usuario'],
                name='unique_participante_por_conversa',
            ),
        ]

    def __str__(self):
        return f'{self.usuario.nome_completo} em {self.conversa}'


class MensagemChat(models.Model):
    """
    Mensagem enviada numa conversa.

    O anexo reaproveita as mesmas regras de tipo e tamanho do forum. O campo de
    midia distingue documento, imagem e audio para que a interface saiba como
    apresentar, sem precisar interpretar a extensao do arquivo.
    """

    MIDIA_CHOICES = [
        ('texto', 'Somente texto'),
        ('imagem', 'Imagem'),
        ('documento', 'Documento'),
        ('audio', 'Audio'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversa = models.ForeignKey(
        Conversa,
        on_delete=models.CASCADE,
        related_name='mensagens',
    )
    autor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='mensagens_enviadas',
    )

    conteudo = models.TextField(blank=True, default='')
    arquivo = models.FileField(upload_to='conversas/%Y/%m/', null=True, blank=True)
    nome_original = models.CharField(max_length=255, blank=True, default='')
    tipo_midia = models.CharField(max_length=12, choices=MIDIA_CHOICES, default='texto')

    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'mensagem_chat'
        verbose_name = 'Mensagem'
        verbose_name_plural = 'Mensagens'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['conversa', '-created_at']),
        ]

    def __str__(self):
        return f'{self.autor.nome_completo}: {self.conteudo[:40]}'


class SolicitacaoAjuda(models.Model):
    """
    Pedido de ajuda originado de uma mensagem do chat.

    E o unico ponto em que conteudo do chat privado chega a quem ensina, e
    mesmo assim de forma recortada: apenas a mensagem marcada e a descricao
    que o aluno escreveu. A conversa em volta continua invisivel.

    O destino depende da disciplina ter monitoria. Quando nao tem, o pedido vai
    direto ao professor, sem o aluno precisar saber disso.
    """

    DESTINO_CHOICES = [
        ('monitoria', 'Monitoria'),
        ('professor', 'Professor'),
        ('ambos', 'Monitoria e professor'),
    ]

    STATUS_CHOICES = [
        ('aberta', 'Aberta'),
        ('em_atendimento', 'Em atendimento'),
        ('resolvida', 'Resolvida'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    mensagem = models.ForeignKey(
        MensagemChat,
        on_delete=models.CASCADE,
        related_name='solicitacoes',
    )
    solicitante = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ajudas_solicitadas',
    )

    descricao = models.TextField(
        blank=True,
        default='',
        help_text='Complemento escrito por quem pediu ajuda',
    )
    destino = models.CharField(max_length=12, choices=DESTINO_CHOICES, default='ambos')
    status = models.CharField(
        max_length=15,
        choices=STATUS_CHOICES,
        default='aberta',
        db_index=True,
    )

    atendido_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ajudas_atendidas',
    )
    resposta = models.TextField(blank=True, default='')
    respondido_em = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'solicitacao_ajuda'
        verbose_name = 'Solicitacao de Ajuda'
        verbose_name_plural = 'Solicitacoes de Ajuda'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', '-created_at']),
        ]

    def __str__(self):
        return f'Ajuda pedida por {self.solicitante.nome_completo} ({self.status})'
