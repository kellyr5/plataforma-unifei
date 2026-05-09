from django.contrib import admin
from .models import (
    Disciplina,
    PermissaoDisciplina,
    Post,
    HistoricoEdicao,
    Voto,
    ReacaoPersiste,
    Arquivo,
    AlertaConteudo,
)

@admin.register(Disciplina)
class DisciplinaAdmin(admin.ModelAdmin):
    list_display = ('codigo', 'nome', 'curso', 'semestre', 'ativo', 'created_at')
    list_filter = ('curso', 'semestre', 'ativo')
    search_fields = ('codigo', 'nome', 'curso')
    readonly_fields = ('id', 'created_at')


@admin.register(PermissaoDisciplina)
class PermissaoDisciplinaAdmin(admin.ModelAdmin):
    list_display = ('usuario', 'disciplina', 'papel', 'ativo', 'created_at')
    list_filter = ('papel', 'ativo')
    search_fields = ('usuario__email', 'disciplina__codigo')
    readonly_fields = ('id', 'created_at')
    autocomplete_fields = ('disciplina',)


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ('titulo_resumo', 'autor', 'disciplina', 'e_topico', 'pontuacao', 'created_at')
    list_filter = ('disciplina', 'e_melhor', 'created_at')
    search_fields = ('titulo', 'conteudo', 'autor__email')
    readonly_fields = ('id', 'created_at', 'updated_at', 'visualizacoes', 'pontuacao')
    autocomplete_fields = ('disciplina',)

    def titulo_resumo(self, obj):
        return obj.titulo if obj.titulo else f'Resposta em {obj.post_pai.titulo[:30]}...'
    titulo_resumo.short_description = 'Titulo'


@admin.register(HistoricoEdicao)
class HistoricoEdicaoAdmin(admin.ModelAdmin):
    list_display = ('post', 'editado_por', 'created_at')
    search_fields = ('post__titulo', 'editado_por__email')
    readonly_fields = ('id', 'created_at')


@admin.register(Voto)
class VotoAdmin(admin.ModelAdmin):
    list_display = ('usuario', 'post', 'created_at')
    readonly_fields = ('id', 'created_at')
    search_fields = ('usuario__cpf', 'usuario__nome_completo')


@admin.register(Arquivo)
class ArquivoAdmin(admin.ModelAdmin):
    list_display = ('nome_original', 'post', 'tamanho_bytes', 'tipo_mime', 'created_at')
    search_fields = ('nome_original',)
    readonly_fields = ('id', 'created_at')


@admin.register(AlertaConteudo)
class AlertaConteudoAdmin(admin.ModelAdmin):
    list_display = ('post', 'denunciante', 'status', 'created_at', 'resolvido_em')
    list_filter = ('status',)
    search_fields = ('motivo', 'denunciante__email')
    readonly_fields = ('id', 'created_at', 'resolvido_em')


@admin.register(ReacaoPersiste)
class ReacaoPersisteAdmin(admin.ModelAdmin):
    list_display = ('usuario', 'post', 'created_at')
    search_fields = ('usuario__cpf', 'usuario__nome_completo', 'comentario')
    readonly_fields = ('id', 'created_at')