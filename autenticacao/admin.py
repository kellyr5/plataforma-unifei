from django.contrib import admin
from .models import Usuario, CodigoAtivacao, RoleGlobal


@admin.register(Usuario)
class UsuarioAdmin(admin.ModelAdmin):
    list_display = ['cpf', 'nome_completo', 'email', 'ativo', 'created_at']
    search_fields = ['cpf', 'nome_completo', 'email']
    list_filter = ['ativo']


@admin.register(CodigoAtivacao)
class CodigoAtivacaoAdmin(admin.ModelAdmin):
    list_display = ['usuario', 'tipo', 'utilizado', 'created_at']


@admin.register(RoleGlobal)
class RoleGlobalAdmin(admin.ModelAdmin):
    list_display = ['usuario', 'role', 'created_at']