"""Serializers dos trabalhos em grupo, conversas e pedidos de ajuda."""

from rest_framework import serializers

from colaboracao.models import (
    ArquivoTrabalho,
    Conversa,
    GrupoTrabalho,
    MembroGrupo,
    MensagemChat,
    SolicitacaoAjuda,
    Trabalho,
)


class MembroGrupoSerializer(serializers.ModelSerializer):
    usuario_nome = serializers.CharField(source='usuario.nome_completo', read_only=True)

    class Meta:
        model = MembroGrupo
        fields = ['id', 'usuario', 'usuario_nome', 'e_lider', 'created_at']
        read_only_fields = ['id', 'created_at']


class GrupoTrabalhoSerializer(serializers.ModelSerializer):
    membros = MembroGrupoSerializer(many=True, read_only=True)
    total_membros = serializers.SerializerMethodField()
    vagas_restantes = serializers.SerializerMethodField()
    conversa_id = serializers.SerializerMethodField()

    class Meta:
        model = GrupoTrabalho
        fields = [
            'id', 'trabalho', 'nome', 'descricao', 'especificacao_propria',
            'membros', 'total_membros', 'vagas_restantes', 'conversa_id',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_total_membros(self, obj) -> int:
        return obj.membros.count()

    def get_vagas_restantes(self, obj) -> int:
        return max(0, obj.trabalho.tamanho_maximo - obj.membros.count())

    def get_conversa_id(self, obj) -> str | None:
        """
        Identificador da conversa, apenas para quem participa do grupo.

        Quem esta de fora ve o grupo e sua composicao, porque isso e publico na
        turma, mas nao recebe o caminho para a conversa privada.
        """
        request = self.context.get('request')
        conversa = getattr(obj, 'conversa', None)

        if conversa is None or request is None:
            return None

        participa = obj.membros.filter(usuario=request.user).exists()
        return str(conversa.id) if participa else None


class ArquivoTrabalhoSerializer(serializers.ModelSerializer):
    """Material de apoio do enunciado."""

    url = serializers.SerializerMethodField()
    enviado_por_nome = serializers.CharField(
        source='enviado_por.nome_completo', read_only=True,
    )

    class Meta:
        model = ArquivoTrabalho
        fields = [
            'id', 'nome_original', 'tamanho_bytes', 'tipo_mime',
            'url', 'enviado_por', 'enviado_por_nome', 'created_at',
        ]
        read_only_fields = fields

    def get_url(self, obj) -> str | None:
        request = self.context.get('request')
        if obj.arquivo and request:
            return request.build_absolute_uri(obj.arquivo.url)
        return None


class TrabalhoSerializer(serializers.ModelSerializer):
    disciplina_codigo = serializers.CharField(source='disciplina.codigo', read_only=True)
    criado_por_nome = serializers.CharField(source='criado_por.nome_completo', read_only=True)
    total_grupos_criados = serializers.SerializerMethodField()
    meu_grupo = serializers.SerializerMethodField()
    arquivos = ArquivoTrabalhoSerializer(many=True, read_only=True)

    class Meta:
        model = Trabalho
        fields = [
            'id', 'disciplina', 'disciplina_codigo',
            'criado_por', 'criado_por_nome',
            'titulo', 'especificacao',
            'total_grupos', 'tamanho_maximo', 'modo_formacao',
            'prazo_entrega', 'encerrado',
            'total_grupos_criados', 'meu_grupo', 'arquivos',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'criado_por', 'created_at', 'updated_at']

    def get_total_grupos_criados(self, obj) -> int:
        return obj.grupos.count()

    def get_meu_grupo(self, obj) -> str | None:
        """Grupo de quem consulta, para a tela saber se ja ha escolha feita."""
        request = self.context.get('request')

        if request is None or not request.user.is_authenticated:
            return None

        membro = MembroGrupo.objects.filter(
            grupo__trabalho=obj, usuario=request.user,
        ).first()

        return str(membro.grupo_id) if membro else None


class MensagemChatSerializer(serializers.ModelSerializer):
    autor_nome = serializers.CharField(source='autor.nome_completo', read_only=True)
    arquivo_url = serializers.SerializerMethodField()
    tem_pedido_ajuda = serializers.SerializerMethodField()

    class Meta:
        model = MensagemChat
        fields = [
            'id', 'conversa', 'autor', 'autor_nome',
            'conteudo', 'arquivo', 'arquivo_url', 'nome_original',
            'tipo_midia', 'tem_pedido_ajuda', 'created_at',
        ]
        read_only_fields = [
            'id', 'conversa', 'autor', 'nome_original', 'created_at',
        ]

    def get_arquivo_url(self, obj) -> str | None:
        request = self.context.get('request')
        if obj.arquivo and request:
            return request.build_absolute_uri(obj.arquivo.url)
        return None

    def get_tem_pedido_ajuda(self, obj) -> bool:
        return obj.solicitacoes.filter(
            status__in=['aberta', 'em_atendimento']
        ).exists()


class ConversaSerializer(serializers.ModelSerializer):
    total_participantes = serializers.SerializerMethodField()
    nao_lidas = serializers.SerializerMethodField()
    ultima_mensagem = serializers.SerializerMethodField()

    class Meta:
        model = Conversa
        fields = [
            'id', 'tipo', 'titulo', 'disciplina', 'grupo', 'semestre',
            'arquivada_em', 'total_participantes', 'nao_lidas',
            'ultima_mensagem', 'created_at',
        ]
        read_only_fields = fields

    def get_total_participantes(self, obj) -> int:
        return obj.participantes.count()

    def get_nao_lidas(self, obj) -> int:
        from colaboracao.services import nao_lidas

        request = self.context.get('request')
        if request is None:
            return 0

        return nao_lidas(obj, request.user)

    def get_ultima_mensagem(self, obj) -> dict | None:
        mensagem = obj.mensagens.filter(
            deleted_at__isnull=True
        ).select_related('autor').last()

        if mensagem is None:
            return None

        return {
            'autor_nome': mensagem.autor.nome_completo,
            'conteudo': mensagem.conteudo[:120],
            'created_at': mensagem.created_at.isoformat(),
        }


class SolicitacaoAjudaSerializer(serializers.ModelSerializer):
    solicitante_nome = serializers.CharField(
        source='solicitante.nome_completo', read_only=True,
    )
    atendido_por_nome = serializers.CharField(
        source='atendido_por.nome_completo', read_only=True, default=None,
    )
    mensagem_conteudo = serializers.CharField(
        source='mensagem.conteudo', read_only=True,
    )
    disciplina_codigo = serializers.CharField(
        source='mensagem.conversa.disciplina.codigo', read_only=True,
    )
    grupo_nome = serializers.SerializerMethodField()

    class Meta:
        model = SolicitacaoAjuda
        fields = [
            'id', 'mensagem', 'mensagem_conteudo',
            'solicitante', 'solicitante_nome',
            'descricao', 'destino', 'status',
            'disciplina_codigo', 'grupo_nome',
            'atendido_por', 'atendido_por_nome', 'resposta', 'respondido_em',
            'created_at',
        ]
        read_only_fields = [
            'id', 'solicitante', 'status', 'atendido_por',
            'resposta', 'respondido_em', 'created_at',
        ]

    def get_grupo_nome(self, obj) -> str | None:
        grupo = obj.mensagem.conversa.grupo
        return grupo.nome if grupo else None
