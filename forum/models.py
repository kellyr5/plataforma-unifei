import uuid
from django.db import models
from django.conf import settings


class Disciplina(models.Model):
    """Disciplinas oferecidas pela universidade, organizadas por curso e semestre."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    codigo = models.CharField(max_length=20, unique=True, db_index=True)
    nome = models.CharField(max_length=255)
    curso = models.CharField(max_length=100)
    semestre = models.CharField(max_length=10, help_text='Ex: 2026.1')
    ativo = models.BooleanField(default=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'disciplina'
        verbose_name = 'Disciplina'
        verbose_name_plural = 'Disciplinas'
        ordering = ['codigo']

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
    visualizacoes = models.IntegerField(default=0)
    pontuacao = models.IntegerField(default=0, help_text='Cache de votos')
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
    """Voto positivo ou negativo de um usuario em um post."""

    TIPO_CHOICES = [
        ('positivo', 'Positivo'),
        ('negativo', 'Negativo'),
    ]

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
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
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
        return f'{self.usuario} votou {self.tipo} em {self.post}'


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
