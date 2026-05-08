from rest_framework import serializers
from forum.models import Disciplina, Post


class DisciplinaSerializer(serializers.ModelSerializer):
    """Serializa o model Disciplina para JSON e vice-versa."""

    class Meta:
        model = Disciplina
        fields = [
            'id',
            'codigo',
            'nome',
            'curso',
            'semestre',
            'ativo',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class PostSerializer(serializers.ModelSerializer):
    """
    Serializa posts (topicos e respostas) do forum.

    O autor e definido automaticamente pelo usuario logado,
    nao deve ser enviado pelo frontend.
    """

    autor_nome = serializers.CharField(source='autor.nome_completo', read_only=True)
    disciplina_codigo = serializers.CharField(source='disciplina.codigo', read_only=True)
    total_respostas = serializers.SerializerMethodField()
    e_topico = serializers.BooleanField(read_only=True)

    class Meta:
        model = Post
        fields = [
            'id',
            'disciplina',
            'disciplina_codigo',
            'autor',
            'autor_nome',
            'post_pai',
            'titulo',
            'conteudo',
            'e_melhor',
            'e_topico',
            'visualizacoes',
            'pontuacao',
            'total_respostas',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'autor',
            'autor_nome',
            'disciplina_codigo',
            'visualizacoes',
            'pontuacao',
            'total_respostas',
            'e_melhor',
            'e_topico',
            'created_at',
            'updated_at',
        ]

    def get_total_respostas(self, obj):
        """Conta quantas respostas o post tem (ignorando deletadas)."""
        return obj.respostas.filter(deleted_at__isnull=True).count()

    def validate(self, data):
        """Valida regras de negocio dos posts."""
        post_pai = data.get('post_pai')
        titulo = data.get('titulo', '').strip()

        # Se e um topico (sem post_pai), o titulo e obrigatorio
        if post_pai is None and not titulo:
            raise serializers.ValidationError({
                'titulo': 'O titulo e obrigatorio para topicos.'
            })

        # Respostas nao precisam de titulo, mas se enviado, sera ignorado
        if post_pai is not None:
            data['titulo'] = ''

        return data
