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
    Acao de voluntariado publicada por uma organizacao parceira.

    A organizacao define se a inscricao requer aprovacao manual ou
    se aceita inscricoes automaticas, conforme a politica da entidade.

    Ha duas modalidades, e a diferenca entre elas nao e cosmetica. Na acao
    presencial o que se oferece e tempo, e por isso ela tem vaga a ocupar e
    carga horaria a cumprir. Na campanha de doacao o que se oferece e material,
    e nenhuma das duas medidas se aplica: nao ha limite de quantas pessoas
    podem doar, e ninguem cumpre hora entregando um agasalho.

    O que a campanha precisa medir e a arrecadacao, numa unidade que so a
    organizacao sabe qual e — pecas de agasalho, quilos de alimento, litros de
    leite. Por isso a unidade e texto livre, e nao uma lista fixa: a proxima
    campanha sera de algo que a lista nao previu.
    """

    MODALIDADE_CHOICES = [
        ('presencial', 'Acao presencial'),
        ('doacao', 'Campanha de doacao'),
    ]

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
    imagem = models.ImageField(
        upload_to='oportunidades/%Y/%m/',
        null=True,
        blank=True,
        help_text='Imagem de capa exibida no cartao da oportunidade',
    )
    o_que_fazer = models.TextField(
        blank=True,
        default='',
        help_text='Atividades que o voluntario ira desempenhar',
    )
    requisitos = models.TextField(
        blank=True,
        default='',
        help_text='O que se espera de quem se inscrever',
    )
    area = models.CharField(max_length=30, choices=AREA_CHOICES, db_index=True)
    local = models.CharField(max_length=255, help_text='Cidade/local de realizacao')

    modalidade = models.CharField(
        max_length=12,
        choices=MODALIDADE_CHOICES,
        default='presencial',
        db_index=True,
        help_text='Presencial mede tempo; doacao mede quantidade arrecadada',
    )

    vagas = models.PositiveIntegerField(
        default=1,
        help_text='Ignorado na campanha de doacao, que nao limita participantes',
    )
    carga_horaria_total = models.PositiveIntegerField(
        help_text='Carga horaria estimada em horas',
    )

    # --- Campos exclusivos da campanha de doacao ---

    unidade_medida = models.CharField(
        max_length=60,
        blank=True,
        default='',
        help_text=(
            'Como a arrecadacao e contada, no plural: pecas de agasalho, '
            'quilos de alimento, litros de leite'
        ),
    )
    meta_quantidade = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text=(
            'Quanto a campanha pretende arrecadar. Opcional: sem meta, a tela '
            'mostra apenas o total, sem barra de progresso'
        ),
    )
    horas_por_participacao = models.PositiveSmallIntegerField(
        default=0,
        help_text=(
            'Horas que a organizacao atribui a quem participa da campanha, '
            'para o certificado. Zero significa certificado sem horas'
        ),
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
    def e_doacao(self):
        return self.modalidade == 'doacao'

    @property
    def vagas_disponiveis(self):
        """
        Vagas ainda livres, ou None quando o conceito nao se aplica.

        Na campanha de doacao nao existe limite de participantes: recusar uma
        doacao porque a vaga acabou nao faz sentido para ninguem.

        A primeira versao devolvia um numero alto para manter a campanha
        sempre aberta sem tratar o caso em cada consulta. Foi um erro: o valor
        atravessou o serializador e apareceu na tela como "999999 vagas
        livres". Sentinela numerica em campo que a interface exibe sempre
        acaba exibida. None obriga cada ponto a decidir o que fazer, que e
        justamente o que se quer aqui.
        """
        if self.e_doacao:
            return None

        ocupadas = self.inscricoes.filter(
            status__in=['aprovada', 'concluida']
        ).count()
        return max(0, self.vagas - ocupadas)

    @property
    def total_arrecadado(self):
        """
        Soma do que foi efetivamente recebido pela organizacao.

        Conta apenas a quantidade confirmada, e nunca a declarada. O estudante
        informa o que pretende entregar, e a organizacao confirma no
        recebimento — somar a declaracao faria a campanha exibir um total que
        nunca chegou.
        """
        if not self.e_doacao:
            return 0

        soma = self.inscricoes.filter(
            status='concluida',
            quantidade_confirmada__isnull=False,
        ).aggregate(total=models.Sum('quantidade_confirmada'))

        return soma['total'] or 0

    @property
    def progresso_meta(self):
        """Fracao da meta ja arrecadada, ou None quando nao ha meta."""
        if not self.e_doacao or not self.meta_quantidade:
            return None
        return min(1.0, self.total_arrecadado / self.meta_quantidade)

    @property
    def esta_aberta_inscricao(self):
        """Indica se a oportunidade ainda aceita inscricoes."""
        from django.utils import timezone
        hoje = timezone.now().date()

        dentro_do_prazo = (
            self.status == 'ativa'
            and self.deleted_at is None
            and hoje <= self.prazo_inscricao
        )

        # A campanha nao tem vaga a esgotar: enquanto o prazo valer, aceita.
        if self.e_doacao:
            return dentro_do_prazo

        return dentro_do_prazo and self.vagas_disponiveis > 0


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

    # --- Campos exclusivos da campanha de doacao ---
    #
    # Dois campos, e nao um, porque intencao e recebimento sao coisas
    # diferentes. O estudante declara o que pretende entregar; a organizacao
    # registra o que de fato recebeu. Guardar so um valor obrigaria a escolher
    # entre confiar na declaracao e perder o registro da intencao — e a
    # diferenca entre os dois numeros e, ela propria, um dado sobre a campanha.

    quantidade_declarada = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='O que o estudante informou que iria entregar',
    )
    quantidade_confirmada = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text=(
            'O que a organizacao confirmou ter recebido. E o unico valor que '
            'entra na contagem da campanha'
        ),
    )
    item_doado = models.CharField(
        max_length=160,
        blank=True,
        default='',
        help_text='Descricao do que foi entregue, quando a campanha aceita itens variados',
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

    # O certificado guarda copia dos dados, e nao referencia ao original: se a
    # organizacao editar a acao depois, o documento ja emitido nao pode mudar.
    # Por isso a contribuicao tambem vem congelada em texto.
    modalidade = models.CharField(
        max_length=12,
        default='presencial',
        help_text='Modalidade da acao no momento da emissao',
    )
    contribuicao = models.CharField(
        max_length=120,
        blank=True,
        default='',
        help_text=(
            'O que foi entregue, ja formatado: "40 pecas de agasalho". Vazio '
            'nas acoes presenciais, onde a contribuicao e o tempo'
        ),
    )

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
