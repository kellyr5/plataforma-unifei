from django.contrib import admin
from reputacao.models import UsuarioDisciplinaReputacao, RankingSemestral


@admin.register(UsuarioDisciplinaReputacao)
class UsuarioDisciplinaReputacaoAdmin(admin.ModelAdmin):
    list_display = (
        'usuario', 'disciplina', 'pontos',
        'total_respostas', 'total_melhores_respostas',
        'total_votos_recebidos', 'atualizado_em',
    )
    list_filter = ('disciplina',)
    search_fields = ('usuario__nome_completo', 'usuario__cpf', 'disciplina__codigo')
    readonly_fields = ('id', 'created_at', 'atualizado_em')
    ordering = ('-pontos',)


@admin.register(RankingSemestral)
class RankingSemestralAdmin(admin.ModelAdmin):
    list_display = (
        'disciplina', 'semestre', 'posicao',
        'nome_usuario', 'pontos', 'gerado_em',
    )
    list_filter = ('disciplina', 'semestre')
    search_fields = ('nome_usuario', 'disciplina__codigo')
    readonly_fields = tuple(f.name for f in RankingSemestral._meta.fields)
