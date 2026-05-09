from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import F

from forum.models import Disciplina, Post, HistoricoEdicao
from forum.api.serializers import DisciplinaSerializer, PostSerializer


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
    - GET /posts/?disciplina={id} -- lista topicos de uma disciplina
    - GET /posts/{id}/respostas/  -- lista respostas de um topico
    - POST /posts/{id}/visualizar/ -- incrementa contador de visualizacoes
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
        """Define o autor como o usuario autenticado."""
        serializer.save(autor=self.request.user)

    def perform_update(self, serializer):
        """Salva snapshot no historico antes de atualizar."""
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
