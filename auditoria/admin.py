from django.contrib import admin
from auditoria.models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """Admin somente leitura. Auditoria e imutavel."""

    list_display = ('created_at', 'usuario', 'acao', 'ip_origem')
    list_filter = ('acao', 'created_at')
    search_fields = (
        'usuario__cpf', 'usuario__nome_completo',
        'descricao', 'ip_origem',
    )
    readonly_fields = (
        'id', 'usuario', 'acao',
        'content_type', 'objeto_id',
        'dados_anteriores', 'dados_novos',
        'ip_origem', 'user_agent',
        'descricao', 'created_at',
    )

    def has_add_permission(self, request):
        return False  # Auditoria so pode ser gerada via signals

    def has_change_permission(self, request, obj=None):
        return False  # Imutavel

    def has_delete_permission(self, request, obj=None):
        return False  # Imutavel
