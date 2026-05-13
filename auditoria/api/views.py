from rest_framework import viewsets, filters

from auditoria.models import AuditLog
from auditoria.api.serializers import AuditLogSerializer


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Listagem de registros de auditoria (somente leitura).

    Regras de acesso:
    - Admin/superuser: ve todos os registros
    - Usuario comum: ve apenas registros que envolvem ele
      (acoes que ele executou OU sobre objetos que ele e dono/autor)

    Filtros disponiveis via query params:
    - ?acao=login -- filtra por tipo de acao
    - ?usuario={id} -- filtra por usuario (so admin)
    - ?data_inicio=2026-05-01 -- filtra por data
    - ?data_fim=2026-05-31
    """

    serializer_class = AuditLogSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['created_at', 'acao']
    ordering = ['-created_at']

    def get_queryset(self):
        usuario = self.request.user
        queryset = AuditLog.objects.select_related('usuario', 'content_type')

        # Aplicacao de regras de visibilidade
        if not (usuario.is_superuser or usuario.is_admin):
            # Usuario comum so ve o que executou
            queryset = queryset.filter(usuario=usuario)
        else:
            # Admin pode filtrar por usuario especifico
            usuario_id = self.request.query_params.get('usuario')
            if usuario_id:
                queryset = queryset.filter(usuario_id=usuario_id)

        # Filtros opcionais aplicaveis a todos
        acao = self.request.query_params.get('acao')
        if acao:
            queryset = queryset.filter(acao=acao)

        data_inicio = self.request.query_params.get('data_inicio')
        if data_inicio:
            queryset = queryset.filter(created_at__gte=data_inicio)

        data_fim = self.request.query_params.get('data_fim')
        if data_fim:
            queryset = queryset.filter(created_at__lte=data_fim)

        return queryset
