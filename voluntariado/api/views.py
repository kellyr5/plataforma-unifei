from rest_framework import viewsets, filters, status, permissions
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from django.db.models import Count
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

    queryset = Oportunidade.objects.none()  # define o tipo da PK para o schema OpenAPI
    serializer_class = OportunidadeSerializer
    # A criacao aceita imagem de capa, entao precisa de multipart.
    parser_classes = [MultiPartParser, FormParser, JSONParser]
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
        # Levanta a excecao em vez de devolver Response.
        #
        # O DRF ignora o retorno de perform_destroy e responde 204 de qualquer
        # forma. Com o return anterior, uma organizacao que tentasse remover a
        # oportunidade de outra recebia confirmacao de sucesso enquanto nada
        # era removido — a resposta afirmava o contrario do que aconteceu.
        if not usuario_e_dono_oportunidade(self.request.user, instance):
            raise PermissionDenied(
                'Apenas a organizacao dona da oportunidade pode remove-la.'
            )

        instance.deleted_at = timezone.now()
        instance.status = 'cancelada'
        instance.save()

    @action(detail=False, methods=['get'])
    def minhas(self, request):
        """
        GET /api/voluntariado/oportunidades/minhas/

        Painel da organizacao: o que ela publicou e como cada vaga esta.

        Traz as contagens por situacao porque e disso que a organizacao
        precisa para agir. Inscricao pendente exige decisao dela; aprovada
        aguardando conclusao exige acompanhamento; e a vaga sem ninguem
        inscrito perto do prazo indica anuncio que nao alcancou ninguem.
        """
        oportunidades = Oportunidade.objects.filter(
            organizacao=request.user, deleted_at__isnull=True,
        ).order_by('-created_at')

        contagens = InscricaoVoluntariado.objects.filter(
            oportunidade__in=oportunidades,
        ).values('oportunidade_id', 'status').annotate(total=Count('id'))

        por_oportunidade = {}
        for linha in contagens:
            por_oportunidade.setdefault(linha['oportunidade_id'], {})[
                linha['status']
            ] = linha['total']

        dados = []
        for oportunidade in oportunidades:
            situacao = por_oportunidade.get(oportunidade.id, {})
            item = OportunidadeSerializer(
                oportunidade, context={'request': request},
            ).data
            item['inscricoes'] = {
                'pendentes': situacao.get('pendente', 0),
                'aprovadas': situacao.get('aprovada', 0),
                'concluidas': situacao.get('concluida', 0),
                'rejeitadas': situacao.get('rejeitada', 0),
            }
            dados.append(item)

        return Response({
            'resumo': {
                'oportunidades': len(dados),
                'pendentes': sum(d['inscricoes']['pendentes'] for d in dados),
                'aprovadas': sum(d['inscricoes']['aprovadas'] for d in dados),
                'concluidas': sum(d['inscricoes']['concluidas'] for d in dados),
            },
            'oportunidades': dados,
        })

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

        # Na campanha de doacao, quem se inscreve ja declara o que pretende
        # entregar. E declaracao, nao registro: o valor fica guardado a parte e
        # nao entra na contagem da campanha ate a organizacao confirmar o
        # recebimento.
        if oportunidade.e_doacao:
            quantidade = request.data.get('quantidade_declarada')

            if quantidade is not None:
                try:
                    quantidade = int(quantidade)
                except (TypeError, ValueError):
                    return Response(
                        {'detail': 'A quantidade informada precisa ser um numero.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if quantidade <= 0:
                    return Response(
                        {'detail': 'Informe uma quantidade maior que zero.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                inscricao_data['quantidade_declarada'] = quantidade

            inscricao_data['item_doado'] = request.data.get(
                'item_doado', ''
            ).strip()[:160]

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

    queryset = InscricaoVoluntariado.objects.none()  # define o tipo da PK para o schema OpenAPI
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

        avaliacao = request.data.get('avaliacao_organizacao', '').strip()
        oportunidade = inscricao.oportunidade

        # O que a organizacao confirma depende da modalidade: horas cumpridas
        # na acao presencial, quantidade recebida na campanha de doacao. Exigir
        # horas de quem esta conferindo um saco de agasalhos obrigaria a
        # inventar um numero.
        if oportunidade.e_doacao:
            quantidade = request.data.get('quantidade_confirmada')

            if quantidade is None:
                # Sem contestacao, vale o que o estudante declarou.
                quantidade = inscricao.quantidade_declarada

            try:
                quantidade = int(quantidade)
            except (TypeError, ValueError):
                return Response(
                    {'detail': 'Informe a quantidade recebida em '
                               '"quantidade_confirmada".'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if quantidade < 0:
                return Response(
                    {'detail': 'A quantidade recebida nao pode ser negativa.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            certificado = concluir_inscricao(
                inscricao=inscricao,
                avaliacao_organizacao=avaliacao,
                avaliado_por=request.user,
                quantidade_confirmada=quantidade,
            )
        else:
            horas = request.data.get('horas_realizadas')
            if not horas or int(horas) <= 0:
                return Response(
                    {'detail': 'Informe um valor valido em "horas_realizadas".'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

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

    queryset = Certificado.objects.none()  # define o tipo da PK para o schema OpenAPI
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
