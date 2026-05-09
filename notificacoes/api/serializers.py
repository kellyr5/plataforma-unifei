from rest_framework import serializers
from notificacoes.models import Notificacao


class NotificacaoSerializer(serializers.ModelSerializer):
    """Serializa notificacoes para a API."""

    remetente_nome = serializers.CharField(
        source='remetente.nome_completo',
        read_only=True,
        default=None,
    )
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    objeto_tipo = serializers.SerializerMethodField()

    class Meta:
        model = Notificacao
        fields = [
            'id', 'tipo', 'tipo_display',
            'titulo', 'mensagem',
            'remetente', 'remetente_nome',
            'objeto_id', 'objeto_tipo',
            'lida', 'lida_em', 'created_at',
        ]
        read_only_fields = fields

    def get_objeto_tipo(self, obj):
        """Retorna o nome do model relacionado para o frontend montar o link."""
        if obj.content_type:
            return obj.content_type.model
        return None
