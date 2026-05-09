from django.contrib import admin
from notificacoes.models import Notificacao


@admin.register(Notificacao)
class NotificacaoAdmin(admin.ModelAdmin):
    list_display = (
        'titulo', 'destinatario', 'remetente',
        'tipo', 'lida', 'created_at',
    )
    list_filter = ('tipo', 'lida', 'created_at')
    search_fields = (
        'titulo', 'mensagem',
        'destinatario__cpf', 'destinatario__nome_completo',
    )
    readonly_fields = (
        'id', 'created_at', 'lida_em',
        'content_type', 'objeto_id',
    )
    ordering = ['-created_at']
