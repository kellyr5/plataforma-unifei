from django.contrib import admin

from colaboracao.models import (
    Conversa,
    GrupoTrabalho,
    MembroGrupo,
    MensagemChat,
    ParticipanteConversa,
    SolicitacaoAjuda,
    Trabalho,
)


@admin.register(Trabalho)
class TrabalhoAdmin(admin.ModelAdmin):
    list_display = ['titulo', 'disciplina', 'total_grupos', 'prazo_entrega', 'encerrado']
    list_filter = ['encerrado', 'modo_formacao']
    search_fields = ['titulo', 'disciplina__codigo']


@admin.register(GrupoTrabalho)
class GrupoTrabalhoAdmin(admin.ModelAdmin):
    list_display = ['nome', 'trabalho']
    search_fields = ['nome', 'trabalho__titulo']


@admin.register(MembroGrupo)
class MembroGrupoAdmin(admin.ModelAdmin):
    list_display = ['usuario', 'grupo', 'e_lider']
    list_filter = ['e_lider']


@admin.register(Conversa)
class ConversaAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'tipo', 'disciplina', 'arquivada_em']
    list_filter = ['tipo']


@admin.register(ParticipanteConversa)
class ParticipanteConversaAdmin(admin.ModelAdmin):
    list_display = ['usuario', 'conversa', 'lido_ate']


@admin.register(MensagemChat)
class MensagemChatAdmin(admin.ModelAdmin):
    list_display = ['autor', 'conversa', 'tipo_midia', 'created_at']
    list_filter = ['tipo_midia']


@admin.register(SolicitacaoAjuda)
class SolicitacaoAjudaAdmin(admin.ModelAdmin):
    list_display = ['solicitante', 'destino', 'status', 'created_at']
    list_filter = ['status', 'destino']
