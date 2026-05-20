"""
Models do modulo de voluntariado.

Estrutura:
- Oportunidade: vaga publicada por uma ONG/organizacao
- InscricaoVoluntariado: vinculo entre estudante e oportunidade
- Certificado: documento gerado apos conclusao da atividade
"""

import uuid
import secrets
from django.conf import settings
from django.db import models


class Oportunidade(models.Model):
    """
    Vaga de voluntariado publicada por uma organizacao parceira.

    A organizacao define se a inscricao requer aprovacao manual ou
    se aceita inscricoes automaticas, conforme a politica da entidade.
    """

    AREA_CHOICES = [
        ('educacao', 'Educacao'),
        ('saude', 'Saude'),
        ('meio_ambiente', 'Meio Ambiente'),
        ('assistencia_social', 'Assistencia Social'),
        ('direitos_humanos', 'Direitos Humanos'),
        ('cultura', 'Cultura e Arte'),
        ('tecnologia', 'Tecnologia'),
        ('esporte', 'Esporte'),
        ('outro', 'Outro'),
    ]

    STATUS_CHOICES = [
        ('ativa', 'Ativa'),
        ('encerrada', 'Encerrada'),
        ('cancelada', 'Cancelada'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organizacao = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='oportunidades_publicadas',
        help_text='Usuario com RoleGlobal=ong ou admin que publicou a oportunidade',
    )

    titulo = models.CharField(max_length=255)
    descricao = models.TextField()
    area = models.CharField(max_length=30, choices=AREA_CHOICES, db_index=True)
    local = models.CharField(max_length=255, help_text='Cidade/local de realizacao')
    vagas = models.PositiveIntegerField(default=1)
    carga_horaria_total = models.PositiveIntegerField(
        help_text='Carga horaria estimada em horas',
    )

    data_inicio = models.DateField()
    data_fim = models.DateField()
    prazo_inscricao = models.DateField()

    requer_aprovacao = models.BooleanField(
        default=True,
        help_text='Se False, inscricoes sao aprovadas automaticamente',
    )

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ativa', db_index=True)

    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'oportunidade'
        verbose_name = 'Oportunidade de Voluntariado'
        verbose_name_plural = 'Oportunidades de Voluntariado'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['area', 'status']),
            models.Index(fields=['data_inicio']),
        ]

    def __str__(self):
        return f'{self.titulo} ({self.organizacao.nome_completo})'

    @property
    def vagas_disponiveis(self):
        """Retorna o numero de vagas ainda disponiveis."""
        ocupadas = self.inscricoes.filter(
            status__in=['aprovada', 'concluida']
        ).count()
        return max(0, self.vagas - ocupadas)

    @property
    def esta_aberta_inscricao(self):
        """Indica se a oportunidade ainda aceita inscricoes."""
        from django.utils import timezone
        hoje = timezone.now().date()
        return (
            self.status == 'ativa'
            and self.deleted_at is None
            and hoje <= self.prazo_inscricao
            and self.vagas_disponiveis > 0
        )


class InscricaoVoluntariado(models.Model):
    """
    Inscricao de um estudante em uma oportunidade de voluntariado.

    O fluxo de status depende do campo requer_aprovacao da oportunidade:
    - Se requer aprovacao: pendente -> aprovada/rejeitada -> concluida
    - Se nao requer: aprovada (automaticamente) -> concluida

    A ONG pode remover um participante a qualquer momento (status=removida),
    independentemente de como ele foi aprovado.
    """

    STATUS_CHOICES = [
        ('pendente', 'Pendente'),
        ('aprovada', 'Aprovada'),
        ('rejeitada', 'Rejeitada'),
        ('removida', 'Removida'),
        ('desistente', 'Desistente'),
        ('concluida', 'Concluida'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    oportunidade = models.ForeignKey(
        Oportunidade,
        on_delete=models.CASCADE,
        related_name='inscricoes',
    )
    estudante = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='inscricoes_voluntariado',
    )

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pendente', db_index=True)

    # Motivacao do estudante ao se inscrever
    motivacao = models.TextField(
        blank=True,
        help_text='Texto livre escrito pelo estudante no momento da inscricao',
    )

    # Dados de avaliacao pela ONG
    avaliado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inscricoes_avaliadas',
    )
    avaliado_em = models.DateTimeField(null=True, blank=True)
    motivo_decisao = models.TextField(
        blank=True,
        help_text='Justificativa para aprovacao, rejeicao ou remocao',
    )

    # Dados de conclusao
    horas_realizadas = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='Horas efetivamente cumpridas, registradas na conclusao',
    )
    avaliacao_organizacao = models.TextField(
        blank=True,
        help_text='Comentario da ONG sobre o desempenho do voluntario',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'inscricao_voluntariado'
        verbose_name = 'Inscricao em Voluntariado'
        verbose_name_plural = 'Inscricoes em Voluntariado'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['oportunidade', 'estudante'],
                name='unique_inscricao_estudante_oportunidade',
            ),
        ]

    def __str__(self):
        return f'{self.estudante.nome_completo} -> {self.oportunidade.titulo} ({self.status})'


def gerar_codigo_certificado():
    """Gera codigo unico alfanumerico para validacao publica do certificado."""
    return secrets.token_urlsafe(12).upper().replace('-', '').replace('_', '')[:16]


class Certificado(models.Model):
    """
    Certificado emitido automaticamente quando uma inscricao vai para 'concluida'.

    Contem dados imutaveis do servico prestado e um codigo unico que permite
    validacao publica (por terceiros, ex: empregadores) atraves de endpoint
    aberto. O codigo de validacao funciona como uma chave de verificacao
    contra falsificacao.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    inscricao = models.OneToOneField(
        InscricaoVoluntariado,
        on_delete=models.PROTECT,
        related_name='certificado',
    )

    # Snapshot dos dados no momento da emissao (preserva mesmo se algo mudar depois)
    nome_estudante = models.CharField(max_length=255)
    cpf_estudante = models.CharField(max_length=11)
    nome_oportunidade = models.CharField(max_length=255)
    nome_organizacao = models.CharField(max_length=255)
    area_atuacao = models.CharField(max_length=50)
    local = models.CharField(max_length=255)
    data_inicio = models.DateField()
    data_fim = models.DateField()
    horas_realizadas = models.PositiveIntegerField()

    codigo_validacao = models.CharField(
        max_length=20,
        unique=True,
        default=gerar_codigo_certificado,
        db_index=True,
        editable=False,
    )

    # Arquivo PDF gerado
    arquivo_pdf = models.FileField(
        upload_to='certificados/%Y/%m/',
        null=True,
        blank=True,
    )

    emitido_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'certificado'
        verbose_name = 'Certificado de Voluntariado'
        verbose_name_plural = 'Certificados de Voluntariado'
        ordering = ['-emitido_em']

    def __str__(self):
        return f'Certificado {self.codigo_validacao} - {self.nome_estudante}'
