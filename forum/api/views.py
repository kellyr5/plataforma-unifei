import os
import magic

from rest_framework import viewsets, filters, permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema
from django.db import transaction
from django.utils import timezone
from django.db.models import F

from auditoria.services import registrar_acao
from notificacoes.services import criar_notificacao

from forum.models import (
    Curso, Disciplina, Post, HistoricoEdicao, Voto,
    ReacaoPersiste, AlertaConteudo, PermissaoDisciplina, Arquivo,
)
from forum.api.serializers import (
    CursoSerializer,
    DisciplinaSerializer,
    PostSerializer,
    AlertaConteudoSerializer,
    ReacaoPersisteSerializer,
    PermissaoDisciplinaSerializer,
    ArquivoSerializer,
)
from forum.validators import (
    MAX_ARQUIVOS_POR_POST,
    sanitizar_nome_arquivo,
    validar_tamanho_arquivo,
    validar_tipo_arquivo,
)
from config.permissions import (
    IsAdminOrSuperuser,
    PodeModerar,
    disciplinas_que_modera,
    e_administrador,
    pode_moderar_disciplina,
)


def usuario_pode_marcar_melhor_resposta(usuario, topico):
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


class CursoViewSet(viewsets.ModelViewSet):
    """
    Cursos de graduacao.

    Consulta liberada a qualquer pessoa autenticada, porque a lista organiza a
    navegacao do forum. Manutencao restrita a coordenacao.
    """

    serializer_class = CursoSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['codigo', 'nome']
    ordering_fields = ['nome', 'codigo']
    ordering = ['nome']

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [IsAdminOrSuperuser()]

    def get_queryset(self):
        return Curso.objects.all()


class MeuAndamentoView(APIView):
    """
    GET /api/forum/andamento/

    Painel de acompanhamento do usuario, por disciplina.

    Substitui a antiga area de reputacao. A diferenca nao e apenas de nome: em
    vez de atribuir pontos e comparar pessoas, aqui o usuario ve o proprio
    percurso na materia, quantas duvidas levantou, quantas respondeu e quantas
    das suas respostas ajudaram alguem. O objetivo e o acompanhamento
    individual, nao a competicao.

    Alem dos totais, devolve a lista das interacoes com o identificador do
    topico correspondente, para que a tela consiga levar o usuario direto a
    discussao em que ele participou. Numa resposta, o topico e o post pai;
    numa duvida, e o proprio post.

    Aceita ?desde=AAAA-MM-DD e ?ate=AAAA-MM-DD para recortar por periodo.
    """

    # Teto de interacoes devolvidas por disciplina, para que um usuario muito
    # ativo nao gere uma resposta gigante. As contagens continuam completas.
    LIMITE_POR_DISCIPLINA = 50

    @extend_schema(
        responses={200: dict},
        tags=['Forum'],
        summary='Meu andamento por disciplina',
    )
    def get(self, request):
        posts = Post.objects.filter(
            autor=request.user,
            deleted_at__isnull=True,
        ).select_related('disciplina', 'post_pai').order_by('-created_at')

        desde = request.query_params.get('desde')
        ate = request.query_params.get('ate')
        if desde:
            posts = posts.filter(created_at__date__gte=desde)
        if ate:
            posts = posts.filter(created_at__date__lte=ate)

        # Agrupa em memoria porque o volume por usuario e pequeno e assim
        # evitamos tres consultas agregadas separadas por disciplina.
        resumo = {}
        for post in posts:
            item = resumo.setdefault(post.disciplina_id, {
                'disciplina_id': str(post.disciplina_id),
                'disciplina_codigo': post.disciplina.codigo,
                'disciplina_nome': post.disciplina.nome,
                'total_posts': 0,
                'total_respostas': 0,
                'total_melhores_respostas': 0,
                'ultima_interacao': None,
                'interacoes': [],
            })

            e_duvida = post.post_pai_id is None

            if e_duvida:
                item['total_posts'] += 1
            else:
                item['total_respostas'] += 1
                if post.e_melhor:
                    item['total_melhores_respostas'] += 1

            if len(item['interacoes']) < self.LIMITE_POR_DISCIPLINA:
                item['interacoes'].append({
                    'post_id': str(post.id),
                    # Destino do clique: a tela do topico sempre.
                    'topico_id': str(post.id if e_duvida else post.post_pai_id),
                    'titulo': post.titulo if e_duvida else (
                        post.post_pai.titulo if post.post_pai else '(tópico removido)'
                    ),
                    'tipo': 'duvida' if e_duvida else 'resposta',
                    'e_melhor': post.e_melhor,
                    'created_at': post.created_at.isoformat(),
                })

            momento = post.created_at.isoformat()
            if item['ultima_interacao'] is None or momento > item['ultima_interacao']:
                item['ultima_interacao'] = momento

        dados = sorted(
            resumo.values(),
            key=lambda item: item['ultima_interacao'],
            reverse=True,
        )

        return Response(dados)


class DisciplinaViewSet(viewsets.ModelViewSet):
    """
    Disciplinas da universidade.

    Qualquer pessoa autenticada consulta, porque a lista alimenta a navegacao
    do forum. Criar, alterar e remover cabe apenas a coordenacao, que e quem
    conhece a oferta do curso no semestre.
    """

    serializer_class = DisciplinaSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['codigo', 'nome', 'curso__nome']
    ordering_fields = ['codigo', 'nome', 'periodo_sugerido', 'created_at']
    ordering = ['periodo_sugerido', 'codigo']

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [IsAdminOrSuperuser()]

    def get_queryset(self):
        queryset = Disciplina.objects.filter(
            deleted_at__isnull=True
        ).select_related('curso')

        curso_id = self.request.query_params.get('curso')
        if curso_id:
            queryset = queryset.filter(curso_id=curso_id)

        periodo = self.request.query_params.get('periodo')
        if periodo:
            queryset = queryset.filter(periodo_sugerido=periodo)

        semestre = self.request.query_params.get('semestre')
        if semestre:
            queryset = queryset.filter(semestre=semestre)

        return queryset

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.ativo = False
        instance.save()


class PermissaoDisciplinaViewSet(viewsets.ModelViewSet):
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
    - POST/DELETE /posts/{id}/marcar-melhor/
    - POST /posts/{id}/anexar/ -- upload de arquivo (multipart/form-data)
    - GET /posts/{id}/arquivos/ -- lista anexos do post
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

    def get_object(self):
        """
        Verifica a autoria antes de qualquer validacao de dados.

        O DRF chama este metodo no inicio de update e destroy, entao a checagem
        aqui garante 403 para quem nao tem direito sobre o post, em vez de um
        400 sobre o conteudo enviado. Recusar por permissao e mais preciso, e
        evita informar a quem nao pode mexer o que estaria errado no corpo.
        """
        post = super().get_object()

        if self.action in ['update', 'partial_update']:
            self._exigir_autoria_ou_moderacao(post, acao='editar')
        elif self.action == 'destroy':
            self._exigir_autoria_ou_moderacao(post, acao='remover')

        return post

    def perform_create(self, serializer):
        serializer.save(autor=self.request.user)

    def _exigir_autoria_ou_moderacao(self, post, acao):
        """
        Somente o autor mexe no proprio conteudo.

        A excecao e a moderacao da disciplina, que precisa poder remover
        conteudo improprio. Sem essa checagem, qualquer pessoa autenticada
        conseguiria editar ou apagar o post de outra.
        """
        usuario = self.request.user

        if post.autor_id == usuario.id:
            return

        if acao == 'remover' and pode_moderar_disciplina(usuario, post.disciplina):
            return

        raise PermissionDenied(
            'Apenas o autor pode editar o proprio post.'
            if acao == 'editar'
            else 'Apenas o autor ou a moderacao da disciplina podem remover este post.'
        )

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

    @action(
        detail=True,
        methods=['post'],
        parser_classes=[MultiPartParser, FormParser],
    )
    def anexar(self, request, pk=None):
        """
        Faz upload de um arquivo como anexo de um post.

        Apenas o autor do post pode anexar arquivos. Limite de 5 arquivos por post,
        10MB cada. Validacao em tres camadas: extensao + magic bytes + tamanho.
        """
        post = self.get_object()
        usuario = request.user

        # So o autor pode anexar (ou admin)
        if post.autor_id != usuario.id and not (usuario.is_admin or usuario.is_superuser):
            return Response(
                {'detail': 'Apenas o autor do post pode anexar arquivos.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Limite de arquivos por post
        total_atual = Arquivo.objects.filter(post=post).count()
        if total_atual >= MAX_ARQUIVOS_POR_POST:
            return Response(
                {'detail': f'Limite de {MAX_ARQUIVOS_POR_POST} arquivos por post atingido.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        arquivo = request.FILES.get('arquivo')
        if not arquivo:
            return Response(
                {'detail': 'Nenhum arquivo enviado. Use o campo "arquivo" no multipart/form-data.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validacao em tres camadas
        try:
            validar_tamanho_arquivo(arquivo)
            validar_tipo_arquivo(arquivo)
        except Exception as e:
            return Response(
                {'detail': str(e.messages[0]) if hasattr(e, 'messages') else str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Captura metadados antes de salvar
        nome_original = arquivo.name
        tamanho = arquivo.size

        inicio = arquivo.read(2048)
        arquivo.seek(0)
        tipo_mime = magic.from_buffer(inicio, mime=True)

        # Sanitiza o nome antes de salvar
        arquivo.name = sanitizar_nome_arquivo(nome_original)

        anexo = Arquivo.objects.create(
            post=post,
            arquivo=arquivo,
            nome_original=nome_original,
            tamanho_bytes=tamanho,
            tipo_mime=tipo_mime,
        )

        serializer = ArquivoSerializer(anexo, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def arquivos(self, request, pk=None):
        """Lista os anexos do post."""
        post = self.get_object()
        anexos = Arquivo.objects.filter(post=post).order_by('-created_at')
        serializer = ArquivoSerializer(anexos, many=True, context={'request': request})
        return Response(serializer.data)


class ArquivoViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Listagem e remocao de arquivos.

    A criacao e feita via POST /posts/{id}/anexar/ (que usa multipart).
    Aqui apenas read e delete.
    """

    serializer_class = ArquivoSerializer
    queryset = Arquivo.objects.all()

    def get_queryset(self):
        return Arquivo.objects.select_related('post', 'post__autor').all()

    def destroy(self, request, *args, **kwargs):
        anexo = self.get_object()
        usuario = request.user

        if anexo.post.autor_id != usuario.id and not (usuario.is_admin or usuario.is_superuser):
            return Response(
                {'detail': 'Apenas o autor do post pode remover anexos.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Remove o arquivo fisico do disco antes de apagar o registro
        if anexo.arquivo:
            anexo.arquivo.delete(save=False)
        anexo.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AlertaConteudoViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Fila de moderacao de conteudo.

    A moderacao e descentralizada: cada monitor ou professor cuida das
    denuncias das disciplinas em que atua, porque e quem tem contexto para
    julgar se o conteudo e mesmo impróprio. O administrador enxerga tudo.

    Fluxo: pendente -> em_analise -> procedente ou improcedente.

    - GET  /alertas/                 lista a fila (filtros: status, disciplina)
    - POST /alertas/{id}/assumir/    marca que o moderador esta cuidando do caso
    - POST /alertas/{id}/liberar/    devolve o caso para a fila
    - POST /alertas/{id}/resolver/   decide e encerra
    """

    queryset = AlertaConteudo.objects.none()  # define o tipo da PK para o schema OpenAPI
    serializer_class = AlertaConteudoSerializer
    permission_classes = [PodeModerar]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['created_at', 'status']
    ordering = ['-created_at']

    def get_queryset(self):
        queryset = AlertaConteudo.objects.select_related(
            'denunciante', 'post', 'post__post_pai', 'post__disciplina',
            'assumido_por', 'resolvido_por',
        )

        # Recorte por disciplina: o moderador so ve o que lhe cabe julgar.
        if not e_administrador(self.request.user):
            queryset = queryset.filter(
                post__disciplina_id__in=disciplinas_que_modera(self.request.user)
            )

        status_filtro = self.request.query_params.get('status')
        if status_filtro:
            queryset = queryset.filter(status=status_filtro)

        disciplina_id = self.request.query_params.get('disciplina')
        if disciplina_id:
            queryset = queryset.filter(post__disciplina_id=disciplina_id)

        return queryset

    @action(detail=True, methods=['post'])
    def assumir(self, request, pk=None):
        """Sinaliza aos demais moderadores que o caso ja tem responsavel."""
        alerta = self.get_object()

        if alerta.status in ['procedente', 'improcedente']:
            return Response(
                {'detail': 'Esta denuncia ja foi resolvida.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if alerta.assumido_por_id and alerta.assumido_por_id != request.user.id:
            return Response(
                {
                    'detail': 'Esta denuncia ja esta sendo analisada por '
                              f'{alerta.assumido_por.nome_completo}.'
                },
                status=status.HTTP_409_CONFLICT
            )

        alerta.status = 'em_analise'
        alerta.assumido_por = request.user
        alerta.assumido_em = timezone.now()
        alerta.save(update_fields=['status', 'assumido_por', 'assumido_em'])

        return Response(self.get_serializer(alerta).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def liberar(self, request, pk=None):
        """Devolve o caso para a fila, quando o moderador nao vai concluir."""
        alerta = self.get_object()

        if alerta.assumido_por_id != request.user.id:
            return Response(
                {'detail': 'Apenas quem assumiu a denuncia pode libera-la.'},
                status=status.HTTP_403_FORBIDDEN
            )

        alerta.status = 'pendente'
        alerta.assumido_por = None
        alerta.assumido_em = None
        alerta.save(update_fields=['status', 'assumido_por', 'assumido_em'])

        return Response(self.get_serializer(alerta).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def resolver(self, request, pk=None):
        """
        Encerra a denuncia.

        Procedente remove o post por soft delete e avisa o autor. Nos dois
        casos o denunciante e informado do desfecho, para que a denuncia nao
        pareca ter caido no vazio.
        """
        alerta = self.get_object()

        if alerta.status in ['procedente', 'improcedente']:
            return Response(
                {'detail': 'Esta denuncia ja foi resolvida.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if alerta.assumido_por_id and alerta.assumido_por_id != request.user.id:
            return Response(
                {
                    'detail': 'Esta denuncia esta sendo analisada por '
                              f'{alerta.assumido_por.nome_completo}.'
                },
                status=status.HTTP_409_CONFLICT
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

        with transaction.atomic():
            alerta.status = decisao
            alerta.resolvido_por = request.user
            alerta.resolucao = resolucao
            alerta.resolvido_em = timezone.now()
            alerta.save()

            if decisao == 'procedente':
                alerta.post.deleted_at = timezone.now()
                alerta.post.save(update_fields=['deleted_at'])

                criar_notificacao(
                    destinatario=alerta.post.autor,
                    tipo='post_removido',
                    titulo='Seu post foi removido pela moderacao',
                    mensagem=(
                        f'Um conteudo seu em {alerta.post.disciplina.codigo} foi '
                        f'removido apos analise de denuncia. Motivo: {resolucao}'
                    ),
                    remetente=request.user,
                    objeto_relacionado=alerta.post.disciplina,
                )

            criar_notificacao(
                destinatario=alerta.denunciante,
                tipo='denuncia_resolvida',
                titulo='Sua denuncia foi analisada',
                mensagem=(
                    f'A denuncia que voce registrou foi julgada {alerta.get_status_display().lower()}. '
                    f'{resolucao}'
                ),
                remetente=request.user,
                objeto_relacionado=alerta.post.disciplina,
            )

            registrar_acao(
                acao='denuncia_resolvida',
                objeto_afetado=alerta.post,
                descricao=(
                    f'Denuncia julgada {decisao} por {request.user.nome_completo} '
                    f'em {alerta.post.disciplina.codigo}.'
                ),
            )

        return Response(self.get_serializer(alerta).data, status=status.HTTP_200_OK)
