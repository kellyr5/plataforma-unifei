from rest_framework import serializers
from forum.models import (
    Curso,
    Disciplina, Post, AlertaConteudo, ReacaoPersiste,
    PermissaoDisciplina, Arquivo,
)
from forum.validators import (
    validar_tamanho_arquivo,
    validar_tipo_arquivo,
    sanitizar_nome_arquivo,
)


class CursoSerializer(serializers.ModelSerializer):
    total_disciplinas = serializers.SerializerMethodField()

    class Meta:
        model = Curso
        fields = [
            'id', 'codigo', 'nome', 'grau', 'versao_ppc',
            'periodos', 'ativo', 'total_disciplinas', 'created_at',
        ]
        read_only_fields = ['id', 'total_disciplinas', 'created_at']

    def get_total_disciplinas(self, obj) -> int:
        return obj.disciplinas.filter(deleted_at__isnull=True).count()


class DisciplinaSerializer(serializers.ModelSerializer):
    curso_nome = serializers.CharField(source='curso.nome', read_only=True, default=None)
    curso_codigo = serializers.CharField(source='curso.codigo', read_only=True, default=None)
    pre_requisitos_codigos = serializers.SerializerMethodField()

    class Meta:
        model = Disciplina
        fields = [
            'id', 'codigo', 'nome',
            'curso', 'curso_codigo', 'curso_nome',
            'periodo_sugerido', 'carga_horaria', 'optativa',
            'pre_requisitos', 'pre_requisitos_codigos',
            'semestre', 'ativo', 'created_at',
        ]
        read_only_fields = [
            'id', 'curso_codigo', 'curso_nome', 'pre_requisitos_codigos', 'created_at',
        ]

    def get_pre_requisitos_codigos(self, obj) -> list:
        return list(obj.pre_requisitos.values_list('codigo', flat=True))


class PostSerializer(serializers.ModelSerializer):
    autor_nome = serializers.CharField(source='autor.nome_completo', read_only=True)
    disciplina_codigo = serializers.CharField(source='disciplina.codigo', read_only=True)
    total_respostas = serializers.SerializerMethodField()
    e_topico = serializers.BooleanField(read_only=True)

    class Meta:
        model = Post
        fields = [
            'id', 'disciplina', 'disciplina_codigo', 'autor', 'autor_nome',
            'post_pai', 'titulo', 'conteudo', 'e_melhor', 'e_topico',
            'visualizacoes', 'pontuacao', 'total_reacoes_persiste',
            'total_respostas', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'autor', 'autor_nome', 'disciplina_codigo', 'visualizacoes',
            'pontuacao', 'total_reacoes_persiste', 'total_respostas',
            'e_melhor', 'e_topico', 'created_at', 'updated_at',
        ]

    def get_total_respostas(self, obj) -> int:
        return obj.respostas.filter(deleted_at__isnull=True).count()

    def validate(self, data):
        """
        Topico precisa de titulo; resposta nao tem titulo.

        Numa atualizacao parcial o corpo costuma trazer so o campo alterado,
        entao os valores ausentes vem do registro que ja esta no banco. Sem
        isso, editar apenas o conteudo de um topico seria recusado por falta
        de titulo, mesmo com o titulo gravado.
        """
        instancia = self.instance

        if 'post_pai' in data:
            post_pai = data['post_pai']
        else:
            post_pai = instancia.post_pai if instancia else None

        if 'titulo' in data:
            titulo = (data['titulo'] or '').strip()
        else:
            titulo = (instancia.titulo if instancia else '').strip()

        if post_pai is None and not titulo:
            raise serializers.ValidationError({'titulo': 'O titulo e obrigatorio para topicos.'})

        if post_pai is not None:
            data['titulo'] = ''

        return data


class AlertaConteudoSerializer(serializers.ModelSerializer):
    denunciante_nome = serializers.CharField(source='denunciante.nome_completo', read_only=True)
    post_titulo = serializers.SerializerMethodField()
    disciplina_codigo = serializers.CharField(source='post.disciplina.codigo', read_only=True)
    assumido_por_nome = serializers.CharField(source='assumido_por.nome_completo', read_only=True)
    resolvido_por_nome = serializers.CharField(source='resolvido_por.nome_completo', read_only=True)

    class Meta:
        model = AlertaConteudo
        fields = [
            'id', 'denunciante', 'denunciante_nome',
            'post', 'post_titulo', 'disciplina_codigo',
            'motivo', 'status',
            'assumido_por', 'assumido_por_nome', 'assumido_em',
            'resolvido_por', 'resolvido_por_nome',
            'resolucao', 'created_at', 'resolvido_em',
        ]
        read_only_fields = [
            'id', 'denunciante', 'denunciante_nome', 'post_titulo',
            'disciplina_codigo', 'status',
            'assumido_por', 'assumido_por_nome', 'assumido_em',
            'resolvido_por', 'resolvido_por_nome',
            'resolucao', 'created_at', 'resolvido_em',
        ]

    def get_post_titulo(self, obj) -> str:
        if obj.post.titulo:
            return obj.post.titulo
        return f'Resposta em: {obj.post.post_pai.titulo[:50]}' if obj.post.post_pai else '(sem titulo)'


class ReacaoPersisteSerializer(serializers.ModelSerializer):
    usuario_nome = serializers.CharField(source='usuario.nome_completo', read_only=True)

    class Meta:
        model = ReacaoPersiste
        fields = ['id', 'usuario', 'usuario_nome', 'post', 'comentario', 'created_at']
        read_only_fields = ['id', 'usuario', 'usuario_nome', 'created_at']


class PermissaoDisciplinaSerializer(serializers.ModelSerializer):
    usuario_nome = serializers.CharField(source='usuario.nome_completo', read_only=True)
    usuario_cpf = serializers.CharField(source='usuario.cpf', read_only=True)
    disciplina_codigo = serializers.CharField(source='disciplina.codigo', read_only=True)
    disciplina_nome = serializers.CharField(source='disciplina.nome', read_only=True)

    class Meta:
        model = PermissaoDisciplina
        fields = [
            'id', 'usuario', 'usuario_cpf', 'usuario_nome',
            'disciplina', 'disciplina_codigo', 'disciplina_nome',
            'papel', 'ativo', 'created_at',
        ]
        read_only_fields = [
            'id', 'usuario_cpf', 'usuario_nome',
            'disciplina_codigo', 'disciplina_nome', 'created_at',
        ]


class ArquivoSerializer(serializers.ModelSerializer):
    """
    Serializa anexos de posts.

    Aplica validacao em tres camadas (extensao, magic bytes, tamanho)
    e sanitiza o nome antes de salvar.
    """

    arquivo_url = serializers.SerializerMethodField()
    tamanho_legivel = serializers.SerializerMethodField()

    class Meta:
        model = Arquivo
        fields = [
            'id', 'post', 'arquivo', 'arquivo_url',
            'nome_original', 'tamanho_bytes', 'tamanho_legivel',
            'tipo_mime', 'created_at',
        ]
        read_only_fields = [
            'id', 'arquivo_url', 'nome_original',
            'tamanho_bytes', 'tamanho_legivel', 'tipo_mime', 'created_at',
        ]

    def get_arquivo_url(self, obj) -> str | None:
        request = self.context.get('request')
        if obj.arquivo and request:
            return request.build_absolute_uri(obj.arquivo.url)
        return None

    def get_tamanho_legivel(self, obj) -> str:
        """Converte bytes em formato legivel (KB ou MB)."""
        bytes_total = obj.tamanho_bytes
        if bytes_total < 1024 * 1024:
            return f'{bytes_total / 1024:.1f} KB'
        return f'{bytes_total / (1024 * 1024):.2f} MB'

    def validate_arquivo(self, value):
        """Aplica validacao em tres camadas."""
        validar_tamanho_arquivo(value)
        validar_tipo_arquivo(value)
        return value
