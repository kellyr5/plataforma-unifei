"""
Permissoes customizadas do modulo voluntariado.
"""

from rest_framework.permissions import BasePermission

from autenticacao.models import RoleGlobal


class IsOngOrAdmin(BasePermission):
    """
    Permite acesso apenas a usuarios com RoleGlobal=ong ou admin/superuser.

    Usado para limitar a publicacao de oportunidades e o gerenciamento
    de inscricoes (aprovar, rejeitar, concluir).
    """

    message = 'Apenas organizacoes parceiras e administradores podem realizar esta acao.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_superuser or request.user.is_admin:
            return True

        return RoleGlobal.objects.filter(
            usuario=request.user,
            role__in=['ong', 'admin'],
        ).exists()
