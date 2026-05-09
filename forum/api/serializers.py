from rest_framework import serializers
from forum.models import Disciplina, Post, AlertaConteudo, ReacaoPersiste


class DisciplinaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Disciplina
        fields = ['id', 'codigo', 'nome', 'curso', 'semestre', 'ativo', 'created_at']
        read_only_fields = ['id', 'created_at']


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

    def get_total_respostas(self, obj):
        return obj.respostas.filter(deleted_at__isnull=True).count()

    def validate(self, data):
        post_pai = data.get('post_pai')
        titulo = data.get('titulo', '').strip()

        if post_pai is None and not titulo:
            raise serializers.ValidationError({'titulo': 'O titulo e obrigatorio para topicos.'})

        if post_pai is not None:
            data['titulo'] = ''

        return data


class AlertaConteudoSerializer(serializers.ModelSerializer):
    denunciante_nome = serializers.CharField(source='denunciante.nome_completo', read_only=True)
    post_titulo = serializers.SerializerMethodField()
    resolvido_por_nome = serializers.CharField(source='resolvido_por.nome_completo', read_only=True)

    class Meta:
        model = AlertaConteudo
        fields = [
            'id', 'denunciante', 'denunciante_nome',
            'post', 'post_titulo',
            'motivo', 'status',
            'resolvido_por', 'resolvido_por_nome',
            'resolucao', 'created_at', 'resolvido_em',
        ]
        read_only_fields = [
            'id', 'denunciante', 'denunciante_nome', 'post_titulo',
            'status', 'resolvido_por', 'resolvido_por_nome',
            'resolucao', 'created_at', 'resolvido_em',
        ]

    def get_post_titulo(self, obj):
        if obj.post.titulo:
            return obj.post.titulo
        return f'Resposta em: {obj.post.post_pai.titulo[:50]}' if obj.post.post_pai else '(sem titulo)'


class ReacaoPersisteSerializer(serializers.ModelSerializer):
    """Serializa reacoes 'duvida persiste' em respostas."""

    usuario_nome = serializers.CharField(source='usuario.nome_completo', read_only=True)

    class Meta:
        model = ReacaoPersiste
        fields = ['id', 'usuario', 'usuario_nome', 'post', 'comentario', 'created_at']
        read_only_fields = ['id', 'usuario', 'usuario_nome', 'created_at']
