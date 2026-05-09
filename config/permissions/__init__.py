from rest_framework.permissions import BasePermission


class IsAdminOrSuperuser(BasePermission):
    """Permite acesso apenas a usuarios com is_admin=True ou is_superuser=True."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return bool(request.user.is_admin or request.user.is_superuser)
