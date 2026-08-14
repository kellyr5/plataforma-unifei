from rest_framework import serializers
from voluntariado.models import Oportunidade, InscricaoVoluntariado, Certificado


class OportunidadeSerializer(serializers.ModelSerializer):
    """Serializa oportunidades de voluntariado."""

    organizacao_nome = serializers.CharField(
        source='organizacao.nome_completo', read_only=True
    )
    organizacao_foto_url = serializers.SerializerMethodField()
    area_display = serializers.CharField(source='get_area_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    vagas_disponiveis = serializers.IntegerField(read_only=True)
    esta_aberta_inscricao = serializers.BooleanField(read_only=True)
    total_inscritos = serializers.SerializerMethodField()
    imagem_url = serializers.SerializerMethodField()
    minha_inscricao = serializers.SerializerMethodField()

    class Meta:
        model = Oportunidade
        fields = [
            'id',
            'organizacao', 'organizacao_nome', 'organizacao_foto_url',
            'titulo', 'descricao', 'o_que_fazer', 'requisitos',
            'imagem', 'imagem_url',
            'area', 'area_display',
            'local',
            'vagas', 'vagas_disponiveis', 'total_inscritos', 'minha_inscricao',
            'carga_horaria_total',
            'data_inicio', 'data_fim', 'prazo_inscricao',
            'requer_aprovacao',
            'status', 'status_display',
            'esta_aberta_inscricao',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'organizacao',
            'created_at', 'updated_at',
        ]

    def get_imagem_url(self, obj) -> str | None:
        request = self.context.get('request')
        if obj.imagem and request:
            return request.build_absolute_uri(obj.imagem.url)
        return None

    def get_organizacao_foto_url(self, obj) -> str | None:
        """
        Logotipo de quem publica a oportunidade.

        A foto enviada tem preferencia sobre o endereco externo: quem subiu a
        imagem pela plataforma fez isso depois, e a intencao mais recente
        prevalece. Sem nenhuma das duas, a tela desenha as iniciais do nome.
        """
        organizacao = obj.organizacao
        request = self.context.get('request')

        if getattr(organizacao, 'foto', None) and request:
            return request.build_absolute_uri(organizacao.foto.url)

        return organizacao.avatar_url or None

    def get_minha_inscricao(self, obj) -> str | None:
        """
        Situacao da inscricao de quem esta consultando, quando existir.

        E uma inscricao por pessoa em cada oportunidade, garantido por
        constraint no banco. A tela precisa saber disso antes de oferecer o
        botao, para nao convidar alguem a repetir algo que sera recusado.
        """
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None

        inscricao = obj.inscricoes.filter(estudante=request.user).first()
        return inscricao.status if inscricao else None

    def get_total_inscritos(self, obj) -> int:
        return obj.inscricoes.count()

    def validate(self, data):
        data_inicio = data.get('data_inicio')
        data_fim = data.get('data_fim')
        prazo_inscricao = data.get('prazo_inscricao')

        if data_inicio and data_fim and data_fim < data_inicio:
            raise serializers.ValidationError({
                'data_fim': 'A data de termino nao pode ser anterior a data de inicio.'
            })

        if prazo_inscricao and data_inicio and prazo_inscricao > data_inicio:
            raise serializers.ValidationError({
                'prazo_inscricao': 'O prazo de inscricao deve ser anterior ou igual a data de inicio.'
            })

        return data


class InscricaoVoluntariadoSerializer(serializers.ModelSerializer):
    """Serializa inscricoes de voluntariado."""

    estudante_nome = serializers.CharField(
        source='estudante.nome_completo', read_only=True
    )
    estudante_cpf = serializers.CharField(source='estudante.cpf', read_only=True)
    oportunidade_titulo = serializers.CharField(
        source='oportunidade.titulo', read_only=True
    )
    oportunidade_organizacao = serializers.CharField(
        source='oportunidade.organizacao.nome_completo', read_only=True
    )
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    avaliado_por_nome = serializers.CharField(
        source='avaliado_por.nome_completo', read_only=True, default=None
    )

    class Meta:
        model = InscricaoVoluntariado
        fields = [
            'id',
            'oportunidade', 'oportunidade_titulo', 'oportunidade_organizacao',
            'estudante', 'estudante_nome', 'estudante_cpf',
            'status', 'status_display',
            'motivacao',
            'avaliado_por', 'avaliado_por_nome', 'avaliado_em', 'motivo_decisao',
            'horas_realizadas', 'avaliacao_organizacao',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id',
            'estudante', 'estudante_nome', 'estudante_cpf',
            'oportunidade_titulo', 'oportunidade_organizacao',
            'status', 'status_display',
            'avaliado_por', 'avaliado_por_nome', 'avaliado_em', 'motivo_decisao',
            'horas_realizadas', 'avaliacao_organizacao',
            'created_at', 'updated_at',
        ]


class CertificadoSerializer(serializers.ModelSerializer):
    """Serializa certificados (somente leitura)."""

    arquivo_pdf_url = serializers.SerializerMethodField()

    class Meta:
        model = Certificado
        fields = [
            'id',
            'codigo_validacao',
            'nome_estudante', 'cpf_estudante',
            'nome_oportunidade', 'nome_organizacao',
            'area_atuacao', 'local',
            'data_inicio', 'data_fim',
            'horas_realizadas',
            'arquivo_pdf_url',
            'emitido_em',
        ]
        read_only_fields = fields

    def get_arquivo_pdf_url(self, obj) -> str | None:
        request = self.context.get('request')
        if obj.arquivo_pdf and request:
            return request.build_absolute_uri(obj.arquivo_pdf.url)
        return None


class CertificadoPublicoSerializer(serializers.ModelSerializer):
    """
    Serializer publico de validacao de certificado.

    Expoe apenas dados essenciais para verificacao por terceiros,
    sem revelar dados pessoais sensiveis como CPF completo.
    """

    cpf_mascarado = serializers.SerializerMethodField()

    class Meta:
        model = Certificado
        fields = [
            'codigo_validacao',
            'nome_estudante', 'cpf_mascarado',
            'nome_oportunidade', 'nome_organizacao',
            'area_atuacao', 'local',
            'data_inicio', 'data_fim',
            'horas_realizadas',
            'emitido_em',
        ]
        read_only_fields = fields

    def get_cpf_mascarado(self, obj):
        """Mascara CPF para protecao de dados (LGPD): xxx.123.456-xx."""
        cpf = obj.cpf_estudante
        if len(cpf) != 11:
            return cpf
        return f'xxx.{cpf[3:6]}.{cpf[6:9]}-xx'
