from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone

from notificacoes.models import Notificacao
from notificacoes.api.serializers import NotificacaoSerializer
from notificacoes.services import contar_nao_lidas


class NotificacaoViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Notificacoes do usuario autenticado.

    Acoes:
    - GET /notificacoes/ -- lista todas (com filtro ?lida=true|false)
    - GET /notificacoes/{id}/ -- detalha
    - GET /notificacoes/nao-lidas/ -- contador rapido
    - POST /notificacoes/{id}/marcar-lida/ -- marca uma como lida
    - POST /notificacoes/marcar-todas-lidas/ -- marca todas como lidas
    """

    serializer_class = NotificacaoSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['created_at', 'lida']
    ordering = ['-created_at']

    def get_queryset(self):
        queryset = Notificacao.objects.filter(
            destinatario=self.request.user
        ).select_related('remetente', 'content_type')

        lida = self.request.query_params.get('lida')
        if lida is not None:
            queryset = queryset.filter(lida=lida.lower() == 'true')

        tipo = self.request.query_params.get('tipo')
        if tipo:
            queryset = queryset.filter(tipo=tipo)

        return queryset

    @action(detail=False, methods=['get'], url_path='nao-lidas')
    def nao_lidas(self, request):
        """Retorna apenas o contador de nao lidas (rapido, sem listar)."""
        total = contar_nao_lidas(request.user)
        return Response({'total': total}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='marcar-lida')
    def marcar_lida(self, request, pk=None):
        """Marca uma notificacao como lida."""
        notificacao = self.get_object()
        notificacao.marcar_como_lida()
        serializer = self.get_serializer(notificacao)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='marcar-todas-lidas')
    def marcar_todas_lidas(self, request):
        """Marca todas as notificacoes nao lidas do usuario como lidas."""
        atualizadas = Notificacao.objects.filter(
            destinatario=request.user,
            lida=False,
        ).update(lida=True, lida_em=timezone.now())

        return Response(
            {
                'detail': f'{atualizadas} notificacao(oes) marcada(s) como lida(s).',
                'atualizadas': atualizadas,
            },
            status=status.HTTP_200_OK,
        )
