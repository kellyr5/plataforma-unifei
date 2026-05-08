from rest_framework import viewsets, filters, permissions
from django.utils import timezone

from forum.models import Disciplina
from forum.api.serializers import DisciplinaSerializer


class DisciplinaViewSet(viewsets.ModelViewSet):
    """
    CRUD de Disciplinas com soft delete e busca por codigo, nome ou curso.
    """

    serializer_class = DisciplinaSerializer
    permission_classes = [permissions.AllowAny]  # TODO: trocar para IsAuthenticated quando o JWT estiver implementado
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['codigo', 'nome', 'curso']
    ordering_fields = ['codigo', 'nome', 'created_at']
    ordering = ['codigo']

    def get_queryset(self):
        """Retorna apenas disciplinas nao deletadas."""
        return Disciplina.objects.filter(deleted_at__isnull=True)

    def perform_destroy(self, instance):
        """Soft delete: marca como deletado em vez de apagar do banco."""
        instance.deleted_at = timezone.now()
        instance.ativo = False
        instance.save()
