from rest_framework import viewsets, filters, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import F, Sum, Case, When, IntegerField

from forum.models import Disciplina, Post, HistoricoEdicao, Voto, AlertaConteudo
from forum.api.serializers import (
    DisciplinaSerializer,
    PostSerializer,
    AlertaConteudoSerializer,
)
from config.permissions import IsAdminOrSuperuser


class DisciplinaViewSet(viewsets.ModelViewSet):
    """CRUD de Disciplinas com soft delete e busca por codigo, nome ou curso."""

    serializer_class = DisciplinaSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['codigo', 'nome', 'curso']
    ordering_fields = ['codigo', 'nome', 'created_at']
    ordering = ['codigo']

    def get_queryset(self):
        return Disciplina.objects.filter(deleted_at__isnull=True)

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.ativo = False
        instance.save()


class PostViewSet(viewsets.ModelViewSet):
    """
    CRUD de Posts (topicos e respostas).

    Acoes adicionais:
    - GET /posts/?disciplina={id}
    - GET /posts/{id}/respostas/
    - POST /posts/{id}/visualizar/
    - POST/DELETE /posts/{id}/votar/
    - POST /posts/{id}/denunciar/
    """

    serializer_class = PostSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['titulo', 'conteudo']
    ordering_fields = ['created_at', 'pontuacao', 'visualizacoes']
    ordering = ['-created_at']

    def get_queryset(self):
        queryset = Post.objects.filter(deleted_at__isnull=True).select_related(
            'autor', 'disciplina', 'post_pai'
        )

        disciplina_id = self.request.query_params.get('disciplina')
        if disciplina_id:
            queryset = queryset.filter(disciplina_id=disciplina_id)

        if self.action == 'list':
            apenas_topicos = self.request.query_params.get('apenas_topicos', 'true')
            if apenas_topicos.lower() == 'true':
                queryset = queryset.filter(post_pai__isnull=True)

        return queryset

    def perform_create(self, serializer):
        serializer.save(autor=self.request.user)

    def perform_update(self, serializer):
        post_atual = self.get_object()
        novo_conteudo = serializer.validated_data.get('conteudo')

        if novo_conteudo and novo_conteudo != post_atual.conteudo:
            HistoricoEdicao.objects.create(
                post=post_atual,
                conteudo_anterior=post_atual.conteudo,
                editado_por=self.request.user,
                motivo=self.request.data.get('motivo_edicao', ''),
            )

        serializer.save()

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.save()

    @action(detail=True, methods=['get'])
    def respostas(self, request, pk=None):
        topico = self.get_object()
        respostas = Post.objects.filter(
            post_pai=topico,
            deleted_at__isnull=True
        ).order_by('-e_melhor', '-pontuacao', 'created_at')

        serializer = self.get_serializer(respostas, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def visualizar(self, request, pk=None):
        post = self.get_object()
        Post.objects.filter(pk=post.pk).update(visualizacoes=F('visualizacoes') + 1)
        post.refresh_from_db()
        return Response({'visualizacoes': post.visualizacoes}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post', 'delete'])
    def votar(self, request, pk=None):
        post = self.get_object()
        usuario = request.user

        if post.autor_id == usuario.id:
            return Response(
                {'detail': 'Voce nao pode votar no proprio post.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        voto_existente = Voto.objects.filter(usuario=usuario, post=post).first()

        if request.method == 'DELETE':
            if voto_existente:
                voto_existente.delete()
                self._recalcular_pontuacao(post)
                return Response(status=status.HTTP_204_NO_CONTENT)
            return Response(
                {'detail': 'Voce ainda nao votou neste post.'},
                status=status.HTTP_404_NOT_FOUND
            )

        tipo = request.data.get('tipo')
        if tipo not in ['positivo', 'negativo']:
            return Response(
                {'detail': 'Campo "tipo" e obrigatorio e deve ser "positivo" ou "negativo".'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if voto_existente:
            if voto_existente.tipo == tipo:
                voto_existente.delete()
                self._recalcular_pontuacao(post)
                return Response(
                    {'detail': 'Voto removido.', 'pontuacao': post.pontuacao},
                    status=status.HTTP_200_OK
                )
            voto_existente.tipo = tipo
            voto_existente.save()
        else:
            Voto.objects.create(usuario=usuario, post=post, tipo=tipo)

        self._recalcular_pontuacao(post)
        return Response(
            {'detail': 'Voto registrado.', 'pontuacao': post.pontuacao, 'tipo': tipo},
            status=status.HTTP_200_OK
        )

    def _recalcular_pontuacao(self, post):
        resultado = Voto.objects.filter(post=post).aggregate(
            total=Sum(
                Case(
                    When(tipo='positivo', then=1),
                    When(tipo='negativo', then=-1),
                    default=0,
                    output_field=IntegerField(),
                )
            )
        )
        post.pontuacao = resultado['total'] or 0
        post.save(update_fields=['pontuacao'])

    @action(detail=True, methods=['post'])
    def denunciar(self, request, pk=None):
        """Cria um alerta de conteudo inapropriado para o post."""
        post = self.get_object()
        usuario = request.user

        if post.autor_id == usuario.id:
            return Response(
                {'detail': 'Voce nao pode denunciar o proprio post.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Impede denuncia duplicada com status pendente ou em analise
        denuncia_existente = AlertaConteudo.objects.filter(
            denunciante=usuario,
            post=post,
            status__in=['pendente', 'em_analise']
        ).exists()

        if denuncia_existente:
            return Response(
                {'detail': 'Voce ja denunciou este post e a denuncia esta sendo analisada.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        motivo = request.data.get('motivo', '').strip()
        if not motivo:
            return Response(
                {'detail': 'O campo "motivo" e obrigatorio.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        alerta = AlertaConteudo.objects.create(
            denunciante=usuario,
            post=post,
            motivo=motivo,
        )

        serializer = AlertaConteudoSerializer(alerta)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class AlertaConteudoViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Listagem e resolucao de denuncias.

    Apenas administradores tem acesso.
    Acoes adicionais:
    - POST /alertas/{id}/resolver/ -- marca como procedente ou improcedente
    """

    serializer_class = AlertaConteudoSerializer
    permission_classes = [IsAdminOrSuperuser]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['created_at', 'status']
    ordering = ['-created_at']

    def get_queryset(self):
        queryset = AlertaConteudo.objects.select_related(
            'denunciante', 'post', 'post__post_pai', 'resolvido_por'
        )
        status_filtro = self.request.query_params.get('status')
        if status_filtro:
            queryset = queryset.filter(status=status_filtro)
        return queryset

    @action(detail=True, methods=['post'])
    def resolver(self, request, pk=None):
        """Marca a denuncia como procedente ou improcedente."""
        alerta = self.get_object()

        if alerta.status in ['procedente', 'improcedente']:
            return Response(
                {'detail': 'Esta denuncia ja foi resolvida.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        decisao = request.data.get('decisao')
        if decisao not in ['procedente', 'improcedente']:
            return Response(
                {'detail': 'Campo "decisao" e obrigatorio e deve ser "procedente" ou "improcedente".'},
                status=status.HTTP_400_BAD_REQUEST
            )

        resolucao = request.data.get('resolucao', '').strip()
        if not resolucao:
            return Response(
                {'detail': 'O campo "resolucao" e obrigatorio.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        alerta.status = decisao
        alerta.resolvido_por = request.user
        alerta.resolucao = resolucao
        alerta.resolvido_em = timezone.now()
        alerta.save()

        # Se procedente, faz soft delete do post denunciado
        if decisao == 'procedente':
            alerta.post.deleted_at = timezone.now()
            alerta.post.save(update_fields=['deleted_at'])

        serializer = self.get_serializer(alerta)
        return Response(serializer.data, status=status.HTTP_200_OK)
