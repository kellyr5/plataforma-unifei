import uuid
from django.db import models
from django.conf import settings


class Curso(models.Model):
    """
    Curso de graduacao, conforme o Projeto Pedagogico de Curso (PPC).

    Antes desta tabela, o curso era um texto livre dentro de Disciplina, o que
    impedia a coordenacao de trabalhar por curso e permitia que a mesma
    graduacao aparecesse escrita de tres maneiras diferentes.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    codigo = models.CharField(max_length=20, unique=True, db_index=True)
    nome = models.CharField(max_length=255)
    grau = models.CharField(
        max_length=30,
        default='bacharelado',
        help_text='Bacharelado, licenciatura, tecnologico',
    )
    versao_ppc = models.CharField(
        max_length=30,
        blank=True,
        help_text='Versao do PPC que originou a matriz, ex: Jan/2025',
    )
    periodos = models.PositiveSmallIntegerField(
        default=8,
        help_text='Quantidade de periodos previstos na matriz',
    )
    ativo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'curso'
        verbose_name = 'Curso'
        verbose_name_plural = 'Cursos'
        ordering = ['nome']

    def __str__(self):
        return f'{self.codigo} - {self.nome}'


class Disciplina(models.Model):
    """
    Disciplinas oferecidas pela universidade.

    O periodo sugerido vem da matriz do PPC e indica onde a disciplina se
    encaixa na trajetoria do curso. Ele nao se confunde com o semestre de
    oferta: uma disciplina de terceiro periodo pode ser ofertada em 2026.1 ou
    em 2026.2, e a coordenacao pode reposicionar a oferta em situacoes
    extraordinarias sem alterar a matriz.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    codigo = models.CharField(max_length=20, unique=True, db_index=True)
    nome = models.CharField(max_length=255)

    curso = models.ForeignKey(
        Curso,
        on_delete=models.PROTECT,
        related_name='disciplinas',
        null=True,
        blank=True,
        help_text='Nulo em disciplinas de outros institutos ainda nao cadastradas',
    )
    periodo_sugerido = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text='Periodo previsto na matriz curricular',
    )
    carga_horaria = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text='Carga horaria total em horas',
    )
    optativa = models.BooleanField(default=False)
    ementa = models.TextField(
        blank=True,
        default='',
        help_text='Descricao da disciplina, conforme o PPC',
    )

    pre_requisitos = models.ManyToManyField(
        'self',
        symmetrical=False,
        blank=True,
        related_name='libera',
        help_text='Disciplinas que precisam ser cursadas antes',
    )
    co_requisitos = models.ManyToManyField(
        'self',
        symmetrical=True,
        blank=True,
        help_text='Disciplinas cursadas no mesmo periodo, como TCC1 e Metodologia Cientifica',
    )

    semestre = models.CharField(max_length=10, help_text='Semestre de oferta, ex: 2026.1')
    ativo = models.BooleanField(default=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'disciplina'
        verbose_name = 'Disciplina'
        verbose_name_plural = 'Disciplinas'
        ordering = ['periodo_sugerido', 'codigo']
        indexes = [
            models.Index(fields=['curso', 'periodo_sugerido']),
        ]

    def __str__(self):
        return f'{self.codigo} - {self.nome}'


class PermissaoDisciplina(models.Model):
    """Define o papel de um usuario dentro de uma disciplina especifica."""

    PAPEL_CHOICES = [
        ('aluno', 'Aluno'),
        ('monitor', 'Monitor'),
        ('professor', 'Professor'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='permissoes_disciplina',
    )
    disciplina = models.ForeignKey(
        Disciplina,
        on_delete=models.CASCADE,
        related_name='permissoes',
    )
    papel = models.CharField(max_length=20, choices=PAPEL_CHOICES)
    ativo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'permissao_disciplina'
        verbose_name = 'Permissao de Disciplina'
        verbose_name_plural = 'Permissoes de Disciplinas'
        constraints = [
            models.UniqueConstraint(
                fields=['usuario', 'disciplina'],
                name='unique_usuario_disciplina',
            ),
        ]

    def __str__(self):
        return f'{self.usuario} - {self.disciplina} ({self.papel})'


class Post(models.Model):
    """Posts do forum. Topicos e respostas ficam na mesma tabela; post_pai diferencia."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    disciplina = models.ForeignKey(
        Disciplina,
        on_delete=models.PROTECT,
        related_name='posts',
    )
    autor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='posts',
    )
    post_pai = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='respostas',
    )
    titulo = models.CharField(max_length=255, blank=True, help_text='Vazio em respostas')
    conteudo = models.TextField()
    e_melhor = models.BooleanField(default=False)

    # Restricao pedagogica, aplicada por monitor ou professor da disciplina.
    # Diferente da remocao por denuncia: o post continua existindo e o autor
    # continua enxergando, com o motivo, para que entenda o que houve. Some
    # apenas para os demais alunos, o que corrige sem expor a pessoa a turma.
    restrito = models.BooleanField(default=False, db_index=True)
    motivo_restricao = models.TextField(blank=True)
    restrito_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='posts_restringidos',
    )
    restrito_em = models.DateTimeField(null=True, blank=True)
    visualizacoes = models.IntegerField(default=0)
    pontuacao = models.IntegerField(default=0, help_text='Cache de votos')
    total_reacoes_persiste = models.IntegerField(
        default=0,
        help_text='Cache de quantos usuarios marcaram que a duvida persiste'
    )
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'post'
        verbose_name = 'Post'
        verbose_name_plural = 'Posts'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['disciplina', 'post_pai']),
            models.Index(fields=['autor']),
        ]

    def __str__(self):
        if self.post_pai:
            return f'Resposta de {self.autor} em {self.post_pai.titulo}'
        return self.titulo

    @property
    def e_topico(self):
        return self.post_pai is None


class HistoricoEdicao(models.Model):
    """Snapshot do conteudo anterior a cada edicao de post."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name='historico_edicoes',
    )
    conteudo_anterior = models.TextField()
    editado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='edicoes_realizadas',
    )
    motivo = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'historico_edicao'
        verbose_name = 'Historico de Edicao'
        verbose_name_plural = 'Historicos de Edicao'
        ordering = ['-created_at']

    def __str__(self):
        return f'Edicao em {self.post} por {self.editado_por}'


class Voto(models.Model):
    """
    Voto positivo (upvote) de um usuario em um post.

    Decisao de design: removemos o downvote para evitar comportamento
    toxico, conforme Cheng et al. (Stanford) e literatura sobre Reddit.
    Para sinalizar respostas insuficientes, ver model ReacaoPersiste.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='votos',
    )
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name='votos',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'voto'
        verbose_name = 'Voto'
        verbose_name_plural = 'Votos'
        constraints = [
            models.UniqueConstraint(
                fields=['usuario', 'post'],
                name='unique_voto_usuario_post',
            ),
        ]

    def __str__(self):
        return f'{self.usuario} votou em {self.post}'


class Arquivo(models.Model):
    """Anexos de posts (PDF, DOC, imagens). Limite de 10MB validado no backend."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name='arquivos',
    )
    arquivo = models.FileField(upload_to='posts/%Y/%m/')
    nome_original = models.CharField(max_length=255)
    tamanho_bytes = models.BigIntegerField()
    tipo_mime = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'arquivo'
        verbose_name = 'Arquivo'
        verbose_name_plural = 'Arquivos'

    def __str__(self):
        return self.nome_original


class AlertaConteudo(models.Model):
    """Denuncias de conteudo inapropriado em posts."""

    STATUS_CHOICES = [
        ('pendente', 'Pendente'),
        ('em_analise', 'Em Analise'),
        ('procedente', 'Procedente'),
        ('improcedente', 'Improcedente'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    denunciante = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='denuncias_feitas',
    )
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name='alertas',
    )
    motivo = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pendente')

    # Registra quem esta cuidando da denuncia enquanto ela nao e resolvida.
    # Sem isso, dois moderadores podem analisar o mesmo caso sem saber.
    assumido_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='denuncias_assumidas',
    )
    assumido_em = models.DateTimeField(null=True, blank=True)

    resolvido_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='denuncias_resolvidas',
    )
    resolucao = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    resolvido_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'alerta_conteudo'
        verbose_name = 'Alerta de Conteudo'
        verbose_name_plural = 'Alertas de Conteudo'
        ordering = ['-created_at']

    def __str__(self):
        return f'Alerta em {self.post} ({self.status})'

class ReacaoPersiste(models.Model):
    """
    Reacao 'duvida persiste' em respostas que nao resolveram a questao.

    Substitui o downvote tradicional por um mecanismo pedagogico: sinaliza
    ao autor da resposta que ela precisa de complementacao, sem criar
    feedback negativo que poderia desencorajar a participacao.

    Aplicavel apenas em respostas (posts com post_pai). Em topicos, a
    sinalizacao equivalente e a ausencia de marcacao de melhor resposta.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reacoes_persiste',
    )
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name='reacoes_persiste',
        help_text='Deve ser uma resposta (post com post_pai)'
    )
    comentario = models.TextField(
        blank=True,
        help_text='Opcional: explicacao do que ainda nao ficou claro'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'reacao_persiste'
        verbose_name = 'Reacao Duvida Persiste'
        verbose_name_plural = 'Reacoes Duvida Persiste'
        constraints = [
            models.UniqueConstraint(
                fields=['usuario', 'post'],
                name='unique_reacao_persiste_usuario_post',
            ),
        ]

    def __str__(self):
        return f'{self.usuario} marcou duvida persistente em {self.post}'