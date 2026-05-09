from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from autenticacao.models import Usuario, CodigoAtivacao, RoleGlobal
from autenticacao.forms import UsuarioCreationForm, UsuarioChangeForm


@admin.register(Usuario)
class UsuarioAdmin(DjangoUserAdmin):
    """Admin do Usuario com forms customizados que hasheiam a senha corretamente."""

    form = UsuarioChangeForm
    add_form = UsuarioCreationForm

    list_display = ['cpf', 'nome_completo', 'email', 'ativo', 'is_admin', 'is_superuser', 'created_at']
    list_filter = ['ativo', 'is_admin', 'is_superuser']
    search_fields = ['cpf', 'nome_completo', 'email']
    ordering = ['cpf']
    readonly_fields = ['id', 'created_at', 'ultimo_acesso']

    fieldsets = (
        ('Credenciais', {
            'fields': ('cpf', 'email', 'password')
        }),
        ('Informacoes Pessoais', {
            'fields': ('nome_completo', 'bio', 'data_nascimento', 'avatar_url')
        }),
        ('Status e Reputacao', {
            'fields': ('ativo', 'reputacao', 'ultimo_acesso')
        }),
        ('Permissoes', {
            'fields': ('is_admin', 'is_superuser', 'groups', 'user_permissions')
        }),
        ('Metadados', {
            'fields': ('id', 'created_at', 'deleted_at')
        }),
    )

    add_fieldsets = (
        ('Dados Obrigatorios', {
            'classes': ('wide',),
            'fields': ('cpf', 'email', 'nome_completo', 'password1', 'password2'),
        }),
    )


@admin.register(CodigoAtivacao)
class CodigoAtivacaoAdmin(admin.ModelAdmin):
    list_display = ['usuario', 'tipo', 'utilizado', 'tentativas', 'data_expiracao', 'created_at']
    list_filter = ['tipo', 'utilizado']
    search_fields = ['usuario__cpf', 'usuario__email', 'codigo']
    readonly_fields = ['id', 'created_at']


@admin.register(RoleGlobal)
class RoleGlobalAdmin(admin.ModelAdmin):
    list_display = ['usuario', 'role', 'created_at']
    list_filter = ['role']
    search_fields = ['usuario__cpf', 'usuario__email']
    readonly_fields = ['id', 'created_at']
