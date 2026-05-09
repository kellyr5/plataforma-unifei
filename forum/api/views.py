from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import F

from forum.models import (
    Disciplina, Post, HistoricoEdicao, Voto,
    ReacaoPersiste, AlertaConteudo, PermissaoDisciplina,
)
from forum.api.serializers import (
    DisciplinaSerializer,
    PostSerializer,
    AlertaConteudoSerializer,
    ReacaoPersisteSerializer,
    PermissaoDisciplinaSerializer,
)
from config.permissions import IsAdminOrSuperuser


def usuario_pode_marcar_melhor_resposta(usuario, topico):
    """
    Determina se o usuario tem permissao para marcar a melhor resposta de um topico.

    Permitido para:
    - Autor do topico (mas nao na propria resposta — verificado no endpoint)
    - Monitor ou Professor com PermissaoDisciplina ativa na disciplina do topico
    - Administradores e superusuarios
    """
    if usuario.is_superuser or usuario.is_admin:
        return True

    if topico.autor_id == usuario.id:
        return True

    return PermissaoDisciplina.objects.filter(
        usuario=usuario,
        disciplina=topico.disciplina,
        papel__in=['monitor', 'professor'],
        ativo=True,
    ).exists()


class DisciplinaViewSet(viewsets.ModelViewSet):
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


class PermissaoDisciplinaViewSet(viewsets.ModelViewSet):
    """
    CRUD de permissoes de disciplina. Apenas administradores tem acesso.

    Permite cadastrar quem e aluno, monitor ou professor de cada disciplina.
    """

    serializer_class = PermissaoDisciplinaSerializer
    permission_classes = [IsAdminOrSuperuser]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['created_at', 'papel']
    ordering = ['-created_at']

    def get_queryset(self):
        queryset = PermissaoDisciplina.objects.select_related('usuario', 'disciplina')

        disciplina_id = self.request.query_params.get('disciplina')
        usuario_id = self.request.query_params.get('usuario')
        papel = self.request.query_params.get('papel')

        if disciplina_id:
            queryset = queryset.filter(disciplina_id=disciplina_id)
        if usuario_id:
            queryset = queryset.filter(usuario_id=usuario_id)
        if papel:
            queryset = queryset.filter(papel=papel)

        return queryset


class PostViewSet(viewsets.ModelViewSet):
    """
    CRUD de Posts (topicos e respostas).

    Acoes adicionais:
    - GET /posts/?disciplina={id}
    - GET /posts/{id}/respostas/
    - POST /posts/{id}/visualizar/
    - POST/DELETE /posts/{id}/votar/
    - POST/DELETE /posts/{id}/reagir-persiste/
    - POST /posts/{id}/denunciar/
    - POST /posts/{id}/marcar-melhor/ -- marca a resposta como melhor (so autor topico/monitor/prof)
    - DELETE /posts/{id}/marcar-melhor/ -- desmarca
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

        if voto_existente:
            voto_existente.delete()
            self._recalcular_pontuacao(post)
            return Response(
                {'detail': 'Voto removido.', 'pontuacao': post.pontuacao},
                status=status.HTTP_200_OK
            )

        Voto.objects.create(usuario=usuario, post=post)
        self._recalcular_pontuacao(post)
        return Response(
            {'detail': 'Voto registrado.', 'pontuacao': post.pontuacao},
            status=status.HTTP_200_OK
        )

    def _recalcular_pontuacao(self, post):
        post.pontuacao = Voto.objects.filter(post=post).count()
        post.save(update_fields=['pontuacao'])

    @action(detail=True, methods=['post', 'delete'], url_path='reagir-persiste')
    def reagir_persiste(self, request, pk=None):
        post = self.get_object()
        usuario = request.user

        if post.post_pai is None:
            return Response(
                {'detail': 'A reacao "duvida persiste" so e aplicavel em respostas, nao em topicos.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if post.autor_id == usuario.id:
            return Response(
                {'detail': 'Voce nao pode reagir na propria resposta.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        reacao_existente = ReacaoPersiste.objects.filter(usuario=usuario, post=post).first()

        if request.method == 'DELETE':
            if reacao_existente:
                reacao_existente.delete()
                self._recalcular_reacoes_persiste(post)
                return Response(status=status.HTTP_204_NO_CONTENT)
            return Response(
                {'detail': 'Voce nao tem reacao registrada nesta resposta.'},
                status=status.HTTP_404_NOT_FOUND
            )

        comentario = request.data.get('comentario', '').strip()

        if reacao_existente:
            return Response(
                {'detail': 'Voce ja marcou que sua duvida persiste nesta resposta.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        ReacaoPersiste.objects.create(
            usuario=usuario,
            post=post,
            comentario=comentario,
        )
        self._recalcular_reacoes_persiste(post)

        return Response(
            {
                'detail': 'Reacao registrada. O autor sera notificado para complementar a resposta.',
                'total_reacoes_persiste': post.total_reacoes_persiste,
            },
            status=status.HTTP_201_CREATED
        )

    def _recalcular_reacoes_persiste(self, post):
        post.total_reacoes_persiste = ReacaoPersiste.objects.filter(post=post).count()
        post.save(update_fields=['total_reacoes_persiste'])

    @action(detail=True, methods=['post'])
    def denunciar(self, request, pk=None):
        post = self.get_object()
        usuario = request.user

        if post.autor_id == usuario.id:
            return Response(
                {'detail': 'Voce nao pode denunciar o proprio post.'},
                status=status.HTTP_400_BAD_REQUEST
            )

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

    @action(detail=True, methods=['post', 'delete'], url_path='marcar-melhor')
    def marcar_melhor(self, request, pk=None):
        """
        POST: marca a resposta como melhor do topico.
        DELETE: desmarca a resposta como melhor.

        Permitido para autor do topico, monitor/professor da disciplina, ou admin.
        Restricoes:
        - So funciona em respostas (post_pai != null)
        - Autor da resposta nao pode marcar a propria resposta (anti auto-validacao)
        - So uma resposta pode ser marcada como melhor por topico
        """
        resposta = self.get_object()
        usuario = request.user

        if resposta.post_pai is None:
            return Response(
                {'detail': 'Apenas respostas podem ser marcadas como melhor (topicos nao).'},
                status=status.HTTP_400_BAD_REQUEST
            )

        topico = resposta.post_pai

        if not usuario_pode_marcar_melhor_resposta(usuario, topico):
            return Response(
                {'detail': 'Voce nao tem permissao para marcar a melhor resposta deste topico. '
                           'Apenas o autor do topico, monitores e professores da disciplina podem fazer isso.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Anti auto-validacao: autor da resposta nao pode marcar a propria resposta
        if resposta.autor_id == usuario.id:
            return Response(
                {'detail': 'Voce nao pode marcar a propria resposta como melhor.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if request.method == 'DELETE':
            if not resposta.e_melhor:
                return Response(
                    {'detail': 'Esta resposta nao esta marcada como melhor.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            resposta.e_melhor = False
            resposta.save(update_fields=['e_melhor'])
            return Response(
                {'detail': 'Marcacao removida.'},
                status=status.HTTP_200_OK
            )

        # POST: garantir que apenas uma resposta seja a melhor
        Post.objects.filter(
            post_pai=topico,
            e_melhor=True,
        ).exclude(pk=resposta.pk).update(e_melhor=False)

        resposta.e_melhor = True
        resposta.save(update_fields=['e_melhor'])

        return Response(
            {
                'detail': 'Resposta marcada como melhor.',
                'resposta_id': str(resposta.id),
            },
            status=status.HTTP_200_OK
        )


class AlertaConteudoViewSet(viewsets.ReadOnlyModelViewSet):
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

        if decisao == 'procedente':
            alerta.post.deleted_at = timezone.now()
            alerta.post.save(update_fields=['deleted_at'])

        serializer = self.get_serializer(alerta)
        return Response(serializer.data, status=status.HTTP_200_OK)
