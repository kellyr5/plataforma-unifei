from rest_framework import serializers
from reputacao.models import UsuarioDisciplinaReputacao, RankingSemestral


class UsuarioDisciplinaReputacaoSerializer(serializers.ModelSerializer):
    """Serializa a reputacao de um usuario em uma disciplina."""

    usuario_nome = serializers.CharField(source='usuario.nome_completo', read_only=True)
    disciplina_codigo = serializers.CharField(source='disciplina.codigo', read_only=True)
    disciplina_nome = serializers.CharField(source='disciplina.nome', read_only=True)

    class Meta:
        model = UsuarioDisciplinaReputacao
        fields = [
            'id',
            'usuario', 'usuario_nome',
            'disciplina', 'disciplina_codigo', 'disciplina_nome',
            'pontos',
            'total_posts', 'total_respostas',
            'total_votos_recebidos', 'total_melhores_respostas',
            'atualizado_em',
        ]
        read_only_fields = fields


class RankingDisciplinaSerializer(serializers.ModelSerializer):
    """Serializa uma posicao no ranking ao vivo de uma disciplina."""

    usuario_nome = serializers.CharField(source='usuario.nome_completo', read_only=True)
    posicao = serializers.IntegerField(read_only=True)

    class Meta:
        model = UsuarioDisciplinaReputacao
        fields = [
            'posicao',
            'usuario', 'usuario_nome',
            'pontos',
            'total_respostas', 'total_melhores_respostas',
        ]
        read_only_fields = fields


class RankingSemestralSerializer(serializers.ModelSerializer):
    """Serializa uma posicao em um ranking semestral historico."""

    disciplina_codigo = serializers.CharField(source='disciplina.codigo', read_only=True)

    class Meta:
        model = RankingSemestral
        fields = [
            'id',
            'disciplina', 'disciplina_codigo',
            'semestre',
            'posicao', 'usuario', 'nome_usuario', 'pontos',
            'gerado_em',
        ]
        read_only_fields = fields
