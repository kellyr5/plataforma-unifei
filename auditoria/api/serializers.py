from rest_framework import serializers
from auditoria.models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    """Serializa registros de auditoria (somente leitura)."""

    usuario_cpf = serializers.CharField(source='usuario.cpf', read_only=True, default=None)
    usuario_nome = serializers.CharField(
        source='usuario.nome_completo', read_only=True, default=None
    )
    acao_display = serializers.CharField(source='get_acao_display', read_only=True)
    objeto_tipo = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            'id',
            'usuario', 'usuario_cpf', 'usuario_nome',
            'acao', 'acao_display',
            'objeto_id', 'objeto_tipo',
            'dados_anteriores', 'dados_novos',
            'ip_origem', 'user_agent',
            'descricao', 'created_at',
        ]
        read_only_fields = fields

    def get_objeto_tipo(self, obj):
        if obj.content_type:
            return obj.content_type.model
        return None
