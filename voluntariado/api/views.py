from rest_framework import viewsets, filters, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone

from voluntariado.models import Oportunidade, InscricaoVoluntariado, Certificado
from voluntariado.api.serializers import (
    OportunidadeSerializer,
    InscricaoVoluntariadoSerializer,
    CertificadoSerializer,
    CertificadoPublicoSerializer,
)
from voluntariado.api.permissions import IsOngOrAdmin
from voluntariado.services import concluir_inscricao


def usuario_e_dono_oportunidade(usuario, oportunidade):
    """Retorna True se o usuario for a organizacao dona ou um admin."""
    if usuario.is_superuser or usuario.is_admin:
        return True
    return oportunidade.organizacao_id == usuario.id


class OportunidadeViewSet(viewsets.ModelViewSet):
    """
    CRUD de oportunidades de voluntariado.

    - GET (lista/detalhe): qualquer usuario autenticado
    - POST/PUT/PATCH/DELETE: apenas organizacao dona ou admin
    - Filtros: ?area=, ?status=, ?search=, ?aberta=true
    """

    serializer_class = OportunidadeSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['titulo', 'descricao', 'local']
    ordering_fields = ['created_at', 'data_inicio', 'prazo_inscricao']
    ordering = ['-created_at']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsOngOrAdmin()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        queryset = Oportunidade.objects.filter(
            deleted_at__isnull=True
        ).select_related('organizacao')

        area = self.request.query_params.get('area')
        if area:
            queryset = queryset.filter(area=area)

        status_filtro = self.request.query_params.get('status')
        if status_filtro:
            queryset = queryset.filter(status=status_filtro)

        aberta = self.request.query_params.get('aberta')
        if aberta and aberta.lower() == 'true':
            hoje = timezone.now().date()
            queryset = queryset.filter(
                status='ativa',
                prazo_inscricao__gte=hoje,
            )

        return queryset

    def perform_create(self, serializer):
        serializer.save(organizacao=self.request.user)

    def update(self, request, *args, **kwargs):
        oportunidade = self.get_object()
        if not usuario_e_dono_oportunidade(request.user, oportunidade):
            return Response(
                {'detail': 'Apenas a organizacao dona da oportunidade pode edita-la.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        if not usuario_e_dono_oportunidade(self.request.user, instance):
            return Response(
                {'detail': 'Apenas a organizacao dona da oportunidade pode remove-la.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        instance.deleted_at = timezone.now()
        instance.status = 'cancelada'
        instance.save()

    @action(detail=True, methods=['post'])
    def inscrever(self, request, pk=None):
        """Inscreve o estudante autenticado na oportunidade."""
        oportunidade = self.get_object()
        estudante = request.user

        # ONG nao pode se inscrever na propria oportunidade
        if oportunidade.organizacao_id == estudante.id:
            return Response(
                {'detail': 'Voce nao pode se inscrever na propria oportunidade.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not oportunidade.esta_aberta_inscricao:
            return Response(
                {'detail': 'Esta oportunidade nao esta mais aceitando inscricoes.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Impede inscricao duplicada
        inscricao_existente = InscricaoVoluntariado.objects.filter(
            oportunidade=oportunidade,
            estudante=estudante,
        ).exclude(status__in=['rejeitada', 'removida', 'desistente']).first()

        if inscricao_existente:
            return Response(
                {'detail': f'Voce ja possui uma inscricao nesta oportunidade ({inscricao_existente.get_status_display()}).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        motivacao = request.data.get('motivacao', '').strip()

        # Define status inicial conforme politica da oportunidade
        status_inicial = 'pendente' if oportunidade.requer_aprovacao else 'aprovada'

        inscricao_data = {
            'oportunidade': oportunidade,
            'estudante': estudante,
            'motivacao': motivacao,
            'status': status_inicial,
        }

        if status_inicial == 'aprovada':
            inscricao_data['avaliado_em'] = timezone.now()

        inscricao = InscricaoVoluntariado.objects.create(**inscricao_data)
        serializer = InscricaoVoluntariadoSerializer(inscricao)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def inscricoes(self, request, pk=None):
        """Lista as inscricoes de uma oportunidade (apenas organizacao dona/admin)."""
        oportunidade = self.get_object()
        if not usuario_e_dono_oportunidade(request.user, oportunidade):
            return Response(
                {'detail': 'Apenas a organizacao dona pode ver as inscricoes.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        status_filtro = request.query_params.get('status')
        inscricoes = oportunidade.inscricoes.select_related('estudante').all()

        if status_filtro:
            inscricoes = inscricoes.filter(status=status_filtro)

        serializer = InscricaoVoluntariadoSerializer(inscricoes, many=True)
        return Response(serializer.data)


class InscricaoVoluntariadoViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Gerenciamento de inscricoes de voluntariado.

    Visibilidade:
    - Estudante: ve suas proprias inscricoes
    - Organizacao: ve as inscricoes das suas oportunidades
    - Admin: ve todas

    Acoes:
    - POST /inscricoes/{id}/aprovar/
    - POST /inscricoes/{id}/rejeitar/
    - POST /inscricoes/{id}/remover/
    - POST /inscricoes/{id}/concluir/
    - POST /inscricoes/{id}/desistir/  (apenas o proprio estudante)
    """

    serializer_class = InscricaoVoluntariadoSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['created_at', 'status']
    ordering = ['-created_at']

    def get_queryset(self):
        usuario = self.request.user
        queryset = InscricaoVoluntariado.objects.select_related(
            'oportunidade', 'oportunidade__organizacao',
            'estudante', 'avaliado_por',
        )

        if usuario.is_superuser or usuario.is_admin:
            return queryset

        # Estudante OU organizacao da oportunidade
        from django.db.models import Q
        return queryset.filter(
            Q(estudante=usuario) | Q(oportunidade__organizacao=usuario)
        )

    def _verificar_permissao_ong(self, inscricao, usuario):
        """ONG da oportunidade ou admin podem decidir."""
        if usuario.is_superuser or usuario.is_admin:
            return True
        return inscricao.oportunidade.organizacao_id == usuario.id

    @action(detail=True, methods=['post'])
    def aprovar(self, request, pk=None):
        """ONG aprova a inscricao."""
        inscricao = self.get_object()
        if not self._verificar_permissao_ong(inscricao, request.user):
            return Response(
                {'detail': 'Apenas a organizacao dona da oportunidade pode aprovar.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if inscricao.status != 'pendente':
            return Response(
                {'detail': f'Apenas inscricoes pendentes podem ser aprovadas. Status atual: {inscricao.get_status_display()}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if inscricao.oportunidade.vagas_disponiveis <= 0:
            return Response(
                {'detail': 'Nao ha mais vagas disponiveis nesta oportunidade.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        inscricao.status = 'aprovada'
        inscricao.avaliado_por = request.user
        inscricao.avaliado_em = timezone.now()
        inscricao.motivo_decisao = request.data.get('motivo_decisao', '').strip()
        inscricao.save()

        serializer = self.get_serializer(inscricao)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def rejeitar(self, request, pk=None):
        """ONG rejeita a inscricao."""
        inscricao = self.get_object()
        if not self._verificar_permissao_ong(inscricao, request.user):
            return Response(
                {'detail': 'Apenas a organizacao dona da oportunidade pode rejeitar.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if inscricao.status != 'pendente':
            return Response(
                {'detail': 'Apenas inscricoes pendentes podem ser rejeitadas.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        motivo = request.data.get('motivo_decisao', '').strip()
        if not motivo:
            return Response(
                {'detail': 'O campo "motivo_decisao" e obrigatorio na rejeicao.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        inscricao.status = 'rejeitada'
        inscricao.avaliado_por = request.user
        inscricao.avaliado_em = timezone.now()
        inscricao.motivo_decisao = motivo
        inscricao.save()

        serializer = self.get_serializer(inscricao)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def remover(self, request, pk=None):
        """ONG remove um participante (mesmo se ja aprovado)."""
        inscricao = self.get_object()
        if not self._verificar_permissao_ong(inscricao, request.user):
            return Response(
                {'detail': 'Apenas a organizacao dona pode remover participantes.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if inscricao.status in ['concluida', 'removida', 'desistente', 'rejeitada']:
            return Response(
                {'detail': f'Nao e possivel remover uma inscricao com status {inscricao.get_status_display()}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        motivo = request.data.get('motivo_decisao', '').strip()
        if not motivo:
            return Response(
                {'detail': 'O campo "motivo_decisao" e obrigatorio na remocao.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        inscricao.status = 'removida'
        inscricao.avaliado_por = request.user
        inscricao.avaliado_em = timezone.now()
        inscricao.motivo_decisao = motivo
        inscricao.save()

        serializer = self.get_serializer(inscricao)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def concluir(self, request, pk=None):
        """ONG marca a inscricao como concluida e emite o certificado."""
        inscricao = self.get_object()
        if not self._verificar_permissao_ong(inscricao, request.user):
            return Response(
                {'detail': 'Apenas a organizacao dona pode concluir uma inscricao.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if inscricao.status != 'aprovada':
            return Response(
                {'detail': f'Apenas inscricoes aprovadas podem ser concluidas. Status atual: {inscricao.get_status_display()}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        horas = request.data.get('horas_realizadas')
        if not horas or int(horas) <= 0:
            return Response(
                {'detail': 'Informe um valor valido em "horas_realizadas".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        avaliacao = request.data.get('avaliacao_organizacao', '').strip()

        certificado = concluir_inscricao(
            inscricao=inscricao,
            horas_realizadas=int(horas),
            avaliacao_organizacao=avaliacao,
            avaliado_por=request.user,
        )

        return Response(
            {
                'detail': 'Inscricao concluida e certificado emitido.',
                'inscricao': InscricaoVoluntariadoSerializer(inscricao).data,
                'certificado': CertificadoSerializer(certificado, context={'request': request}).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'])
    def desistir(self, request, pk=None):
        """Estudante desiste da inscricao (apenas o proprio)."""
        inscricao = self.get_object()
        if inscricao.estudante_id != request.user.id:
            return Response(
                {'detail': 'Apenas o proprio estudante pode desistir da inscricao.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if inscricao.status not in ['pendente', 'aprovada']:
            return Response(
                {'detail': 'So e possivel desistir de inscricoes pendentes ou aprovadas.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        inscricao.status = 'desistente'
        inscricao.motivo_decisao = request.data.get('motivo_decisao', 'Desistencia solicitada pelo estudante').strip()
        inscricao.save()

        serializer = self.get_serializer(inscricao)
        return Response(serializer.data)


class CertificadoViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Consulta de certificados.

    - GET /certificados/ -- estudante ve os proprios
    - GET /certificados/{id}/ -- detalha
    - GET /certificados/validar/{codigo}/ -- endpoint publico de validacao
    """

    serializer_class = CertificadoSerializer

    def get_queryset(self):
        usuario = self.request.user
        queryset = Certificado.objects.select_related(
            'inscricao', 'inscricao__estudante', 'inscricao__oportunidade',
        )
        if usuario.is_superuser or usuario.is_admin:
            return queryset
        return queryset.filter(inscricao__estudante=usuario)

    @action(
        detail=False,
        methods=['get'],
        url_path=r'validar/(?P<codigo>[A-Z0-9]+)',
        permission_classes=[permissions.AllowAny],
    )
    def validar(self, request, codigo=None):
        """
        Endpoint publico de validacao de certificado por codigo.

        Nao requer autenticacao para permitir verificacao por terceiros
        (ex: empregadores). Mascara CPF do estudante.
        """
        certificado = get_object_or_404(Certificado, codigo_validacao=codigo)
        serializer = CertificadoPublicoSerializer(certificado)
        return Response({
            'valido': True,
            'certificado': serializer.data,
        })
