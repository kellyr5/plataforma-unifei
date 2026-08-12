from rest_framework import filters, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone

from notificacoes.models import Notificacao
from notificacoes.api.serializers import NotificacaoSerializer
from notificacoes.services import contar_nao_lidas


class NotificacaoViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """
    Notificacoes do usuario autenticado.

    A notificacao pertence a quem a recebeu, entao ele pode descarta-la. Nao
    ha soft delete aqui: o aviso e efemero por natureza, e o que precisa ficar
    registrado para prestacao de contas ja esta no log de auditoria.

    Acoes:
    - GET    /notificacoes/                        lista (filtros ?lida= e ?tipo=)
    - GET    /notificacoes/{id}/                   detalha
    - DELETE /notificacoes/{id}/                   exclui uma
    - GET    /notificacoes/nao-lidas/              contador rapido
    - POST   /notificacoes/{id}/marcar-lida/       marca uma como lida
    - POST   /notificacoes/marcar-todas-lidas/     marca todas como lidas
    - POST   /notificacoes/limpar/                 exclui varias de uma vez
    """

    queryset = Notificacao.objects.none()  # define o tipo da PK para o schema OpenAPI
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

    @action(detail=False, methods=['post'])
    def limpar(self, request):
        """
        Exclui notificacoes em lote.

        Sem parametros, remove apenas as ja lidas, que e o caso comum de
        arrumar a caixa sem perder o que ainda nao foi visto. Com
        {"ids": [...]}, remove as indicadas. Com {"todas": true}, remove tudo.
        """
        base = Notificacao.objects.filter(destinatario=request.user)

        ids = request.data.get('ids')
        todas = request.data.get('todas') is True

        if ids:
            alvo = base.filter(id__in=ids)
        elif todas:
            alvo = base
        else:
            alvo = base.filter(lida=True)

        removidas, _ = alvo.delete()

        return Response(
            {
                'detail': f'{removidas} notificacao(oes) removida(s).',
                'removidas': removidas,
            },
            status=status.HTTP_200_OK,
        )

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
