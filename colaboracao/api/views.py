"""
API dos trabalhos em grupo, conversas e pedidos de ajuda.

As views cuidam de permissao e formato; as regras vivem em services.py, que
tambem sera usado pelo consumer de WebSocket.
"""

from datetime import timedelta

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from colaboracao import services
from colaboracao.api.serializers import (
    ArquivoTrabalhoSerializer,
    ConversaSerializer,
    GrupoTrabalhoSerializer,
    MensagemChatSerializer,
    SolicitacaoAjudaSerializer,
    TrabalhoSerializer,
)
from colaboracao.models import (
    ArquivoTrabalho,
    Conversa,
    GrupoTrabalho,
    MensagemChat,
    SolicitacaoAjuda,
    Trabalho,
)
from config.permissions import e_administrador, leciona_disciplina
from forum.models import PermissaoDisciplina


def erro(excecao):
    return Response({'detail': str(excecao)}, status=status.HTTP_400_BAD_REQUEST)


def disciplinas_do_usuario(usuario):
    return PermissaoDisciplina.objects.filter(
        usuario=usuario, ativo=True,
    ).values_list('disciplina_id', flat=True)


class TrabalhoViewSet(viewsets.ModelViewSet):
    """
    Trabalhos em grupo de uma disciplina.

    Quem cursa a disciplina consulta; criar e alterar cabe a quem leciona ou
    monitora, porque a divisao em grupos e decisao pedagogica.
    """

    queryset = Trabalho.objects.none()
    serializer_class = TrabalhoSerializer

    def get_queryset(self):
        usuario = self.request.user

        queryset = Trabalho.objects.filter(
            deleted_at__isnull=True
        ).select_related('disciplina', 'criado_por')

        if not e_administrador(usuario):
            queryset = queryset.filter(
                disciplina_id__in=disciplinas_do_usuario(usuario)
            )

        disciplina = self.request.query_params.get('disciplina')
        if disciplina:
            queryset = queryset.filter(disciplina_id=disciplina)

        return queryset.order_by('-created_at')

    def _exigir_docencia(self, disciplina):
        if not leciona_disciplina(self.request.user, disciplina):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied(
                'Apenas quem leciona ou monitora a disciplina organiza os trabalhos.'
            )

    def perform_create(self, serializer):
        disciplina = serializer.validated_data['disciplina']
        self._exigir_docencia(disciplina)
        serializer.save(criado_por=self.request.user)

    def perform_update(self, serializer):
        self._exigir_docencia(serializer.instance.disciplina)
        serializer.save()

    def perform_destroy(self, instance):
        self._exigir_docencia(instance.disciplina)
        instance.deleted_at = timezone.now()
        instance.save(update_fields=['deleted_at'])

    @action(detail=True, methods=['post'], url_path='criar-grupos')
    def criar_grupos(self, request, pk=None):
        """Cria os grupos vazios previstos, para os alunos se organizarem."""
        trabalho = self.get_object()
        self._exigir_docencia(trabalho.disciplina)

        try:
            total = services.criar_grupos_vazios(trabalho)
        except services.RegraDeGrupo as excecao:
            return erro(excecao)

        return Response({'detail': f'{total} grupo(s) disponivel(is).'})

    # Formatos aceitos como material de apoio. Lista fechada: enumerar o que
    # e permitido resiste a formatos executaveis novos, enquanto enumerar o
    # que e proibido precisa ser revisada a cada um que surge.
    TIPOS_DE_MATERIAL = (
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/zip', 'application/x-zip-compressed',
        'text/plain', 'text/csv', 'text/markdown',
        'image/png', 'image/jpeg',
    )

    TAMANHO_MAXIMO_MATERIAL = 20 * 1024 * 1024

    @action(
        detail=True,
        methods=['post'],
        parser_classes=[MultiPartParser, FormParser],
    )
    def anexar(self, request, pk=None):
        """
        POST /api/colaboracao/trabalhos/{id}/anexar/

        Junta material de apoio ao enunciado: especificacao em PDF, base de
        dados, esqueleto de codigo, rubrica de correcao.

        So quem conduz a turma anexa. O material e da disciplina inteira, e
        deixar qualquer matriculado adicionar arquivo ao enunciado abriria
        caminho para o proprio enunciado ser contestado.
        """
        trabalho = self.get_object()
        self._exigir_docencia(trabalho.disciplina)

        arquivo = request.FILES.get('arquivo')

        if arquivo is None:
            return Response(
                {'detail': 'Nenhum arquivo enviado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if arquivo.size > self.TAMANHO_MAXIMO_MATERIAL:
            return Response(
                {'detail': 'O arquivo passa de 20 MB.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        tipo = (arquivo.content_type or '').split(';')[0].strip().lower()

        if tipo not in self.TIPOS_DE_MATERIAL:
            return Response(
                {
                    'detail': 'Formato não aceito. Envie documento, planilha, '
                              'apresentação, imagem, texto ou arquivo compactado.'
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        material = ArquivoTrabalho.objects.create(
            trabalho=trabalho,
            enviado_por=request.user,
            arquivo=arquivo,
            nome_original=arquivo.name,
            tamanho_bytes=arquivo.size,
            tipo_mime=tipo,
        )

        return Response(
            ArquivoTrabalhoSerializer(material, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=['delete'],
        url_path='anexos/(?P<arquivo_id>[^/.]+)',
    )
    def remover_anexo(self, request, pk=None, arquivo_id=None):
        """Remove um material de apoio. Cabe a quem conduz a turma."""
        trabalho = self.get_object()
        self._exigir_docencia(trabalho.disciplina)

        removidos, _ = ArquivoTrabalho.objects.filter(
            trabalho=trabalho, id=arquivo_id,
        ).delete()

        if not removidos:
            return Response(
                {'detail': 'Arquivo não encontrado neste trabalho.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def sortear(self, request, pk=None):
        """Distribui os matriculados entre os grupos, por sorteio."""
        trabalho = self.get_object()
        self._exigir_docencia(trabalho.disciplina)

        try:
            total = services.sortear_grupos(trabalho)
        except services.RegraDeGrupo as excecao:
            return erro(excecao)

        return Response({'detail': f'{total} estudante(s) distribuido(s).'})


class GrupoTrabalhoViewSet(viewsets.ModelViewSet):
    """Grupos de um trabalho, com entrada e saida dos participantes."""

    queryset = GrupoTrabalho.objects.none()
    serializer_class = GrupoTrabalhoSerializer

    def get_queryset(self):
        usuario = self.request.user

        queryset = GrupoTrabalho.objects.select_related(
            'trabalho', 'trabalho__disciplina',
        ).prefetch_related('membros__usuario')

        if not e_administrador(usuario):
            queryset = queryset.filter(
                trabalho__disciplina_id__in=disciplinas_do_usuario(usuario)
            )

        trabalho = self.request.query_params.get('trabalho')
        if trabalho:
            queryset = queryset.filter(trabalho_id=trabalho)

        return queryset

    def perform_create(self, serializer):
        trabalho = serializer.validated_data['trabalho']

        if not leciona_disciplina(self.request.user, trabalho.disciplina):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied('Apenas quem leciona ou monitora cria grupos.')

        grupo = serializer.save()
        services.abrir_conversa_do_grupo(grupo)

    @action(detail=True, methods=['post'])
    def entrar(self, request, pk=None):
        grupo = self.get_object()

        try:
            services.entrar_no_grupo(grupo, request.user)
        except services.RegraDeGrupo as excecao:
            return erro(excecao)

        return Response(self.get_serializer(grupo).data)

    @action(detail=True, methods=['post'])
    def sair(self, request, pk=None):
        grupo = self.get_object()

        try:
            services.sair_do_grupo(grupo, request.user)
        except services.RegraDeGrupo as excecao:
            return erro(excecao)

        return Response({'detail': f'Voce saiu do {grupo.nome}.'})

    @action(detail=True, methods=['post'], url_path='definir-lider')
    def definir_lider(self, request, pk=None):
        """
        Troca a lideranca.

        Pode ser feito pelo lider atual ou por quem leciona. Deixar a cargo do
        grupo evita que o professor precise mediar cada ajuste interno.
        """
        grupo = self.get_object()
        usuario_id = request.data.get('usuario')

        lider_atual = grupo.membros.filter(usuario=request.user, e_lider=True).exists()
        docente = leciona_disciplina(request.user, grupo.trabalho.disciplina)

        if not (lider_atual or docente):
            return Response(
                {'detail': 'Apenas o lider atual ou quem leciona pode trocar a lideranca.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            services.definir_lider(grupo, usuario_id)
        except services.RegraDeGrupo as excecao:
            return erro(excecao)

        return Response(self.get_serializer(grupo).data)


class ConversaViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """
    Conversas de que a pessoa participa.

    Nao ha criacao por aqui: a conversa de grupo nasce com o grupo, e a de
    turma com a disciplina. Criar avulso produziria conversa sem dono.
    """

    queryset = Conversa.objects.none()
    serializer_class = ConversaSerializer

    def get_queryset(self):
        return Conversa.objects.filter(
            participantes__usuario=self.request.user
        ).select_related('disciplina', 'grupo').distinct().order_by('-created_at')

    @action(detail=True, methods=['get', 'post'])
    def mensagens(self, request, pk=None):
        """
        GET lista as mensagens; POST envia uma nova, com anexo opcional.

        O envio tambem acontece pelo WebSocket. Este caminho existe para o
        anexo, que nao trafega bem por socket, e como alternativa quando a
        conexao em tempo real cai.
        """
        conversa = self.get_object()

        if request.method == 'GET':
            mensagens = conversa.mensagens.filter(
                deleted_at__isnull=True
            ).select_related('autor')

            services.registrar_leitura(conversa, request.user)

            return Response(
                MensagemChatSerializer(
                    mensagens, many=True, context={'request': request},
                ).data
            )

        if conversa.somente_leitura:
            return Response(
                {'detail': 'Esta conversa foi arquivada e nao aceita novas mensagens.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        conteudo = request.data.get('conteudo', '').strip()
        arquivo = request.FILES.get('arquivo')

        if not conteudo and not arquivo:
            return Response(
                {'detail': 'Escreva algo ou anexe um arquivo.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        problema = self._recusar_arquivo(arquivo)
        if problema:
            return Response({'detail': problema}, status=status.HTTP_400_BAD_REQUEST)

        mensagem = MensagemChat.objects.create(
            conversa=conversa,
            autor=request.user,
            conteudo=conteudo,
            arquivo=arquivo,
            nome_original=arquivo.name if arquivo else '',
            tipo_midia=self._classificar(arquivo),
        )

        services.registrar_leitura(conversa, request.user)

        # Quem esta com a conversa aberta recebe o anexo na hora, sem recarregar;
        # quem nao esta recebe a notificacao.
        services.publicar_mensagem(mensagem, request=request)

        return Response(
            MensagemChatSerializer(mensagem, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    # Anexos aceitos na conversa. Lista fechada, e nao lista de proibidos:
    # enumerar o que e permitido resiste a extensoes novas, enquanto enumerar
    # o que e proibido precisa ser atualizada toda vez que surge um formato
    # executavel novo.
    TIPOS_ACEITOS = (
        'image/png', 'image/jpeg', 'image/gif', 'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        # Formatos que os navegadores produzem ao gravar voz: webm/opus na
        # maioria e mp4/aac no Safari.
        'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav',
    )

    TAMANHO_MAXIMO = 10 * 1024 * 1024

    @classmethod
    def _recusar_arquivo(cls, arquivo):
        """Devolve a mensagem de recusa, ou None se o anexo for aceitavel."""
        if arquivo is None:
            return None

        if arquivo.size > cls.TAMANHO_MAXIMO:
            return 'O arquivo passa de 10 MB.'

        # O content_type do navegador pode vir com parametros, como
        # "audio/webm;codecs=opus". Comparamos so o tipo.
        tipo = (arquivo.content_type or '').split(';')[0].strip().lower()

        if tipo not in cls.TIPOS_ACEITOS:
            return (
                'Formato nao aceito na conversa. Envie imagem, PDF, documento '
                'de texto ou audio.'
            )

        return None

    @staticmethod
    def _classificar(arquivo):
        """Separa imagem, audio e documento pelo tipo declarado no envio."""
        if arquivo is None:
            return 'texto'

        tipo = (arquivo.content_type or '').lower()

        if tipo.startswith('image/'):
            return 'imagem'
        if tipo.startswith('audio/'):
            return 'audio'
        return 'documento'

    @action(detail=True, methods=['post'], url_path='marcar-lida')
    def marcar_lida(self, request, pk=None):
        services.registrar_leitura(self.get_object(), request.user)
        return Response({'detail': 'Leitura registrada.'})


class SolicitacaoAjudaViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """
    Pedidos de ajuda vindos das conversas de grupo.

    Quem ensina ve os pedidos das suas disciplinas; quem pediu ve os proprios.
    O conteudo do chat em volta continua invisivel para todos.
    """

    queryset = SolicitacaoAjuda.objects.none()
    serializer_class = SolicitacaoAjudaSerializer

    def get_queryset(self):
        usuario = self.request.user

        queryset = SolicitacaoAjuda.objects.select_related(
            'mensagem', 'mensagem__conversa', 'mensagem__conversa__disciplina',
            'solicitante', 'atendido_por',
        )

        if e_administrador(usuario):
            return queryset.order_by('-created_at')

        from django.db.models import Q

        modera = PermissaoDisciplina.objects.filter(
            usuario=usuario, papel__in=['monitor', 'professor'], ativo=True,
        ).values_list('disciplina_id', flat=True)

        return queryset.filter(
            Q(mensagem__conversa__disciplina_id__in=modera)
            | Q(solicitante=usuario)
        ).distinct().order_by('-created_at')

    @action(detail=True, methods=['post'])
    def assumir(self, request, pk=None):
        """Sinaliza que alguem esta atendendo, evitando resposta duplicada."""
        solicitacao = self.get_object()

        if solicitacao.status == 'resolvida':
            return erro(services.RegraDeGrupo('Este pedido ja foi respondido.'))

        if solicitacao.atendido_por and solicitacao.atendido_por != request.user:
            return Response(
                {
                    'detail': f'Ja esta sendo atendido por '
                              f'{solicitacao.atendido_por.nome_completo}.'
                },
                status=status.HTTP_409_CONFLICT,
            )

        solicitacao.status = 'em_atendimento'
        solicitacao.atendido_por = request.user
        solicitacao.save(update_fields=['status', 'atendido_por'])

        return Response(self.get_serializer(solicitacao).data)

    @action(detail=True, methods=['post'])
    def responder(self, request, pk=None):
        solicitacao = self.get_object()

        if not leciona_disciplina(
            request.user, solicitacao.mensagem.conversa.disciplina
        ):
            return Response(
                {'detail': 'Apenas monitoria e professor respondem pedidos de ajuda.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            services.responder_ajuda(
                solicitacao, request.user, request.data.get('resposta', ''),
            )
        except services.RegraDeGrupo as excecao:
            return erro(excecao)

        return Response(self.get_serializer(solicitacao).data)


class MensagemViewSet(viewsets.GenericViewSet):
    """Ações sobre uma mensagem específica."""

    queryset = MensagemChat.objects.none()
    serializer_class = MensagemChatSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return MensagemChat.objects.filter(
            conversa__participantes__usuario=self.request.user,
            deleted_at__isnull=True,
        ).distinct()

    # Prazo para desfazer o envio.
    #
    # Tres minutos cobrem o arrependimento imediato — a mensagem incompleta, o
    # audio que saiu errado, o destinatario trocado — sem permitir reescrever a
    # conversa depois que ela ja produziu efeito. Grupo de trabalho combina
    # divisao de tarefa pelo chat, e apagar a combinacao de ontem apagaria a
    # prova do que foi acordado.
    PRAZO_EXCLUSAO = timedelta(minutes=3)

    def destroy(self, request, pk=None):
        """
        DELETE /api/colaboracao/mensagens/{id}/

        Remove a propria mensagem, dentro do prazo.

        E remocao logica: a linha permanece no banco com deleted_at
        preenchido. Some da conversa para todos, e o historico de quem
        precisar auditar continua intacto.
        """
        mensagem = get_object_or_404(self.get_queryset(), pk=pk)

        if mensagem.autor_id != request.user.id:
            return Response(
                {'detail': 'Você só pode apagar as próprias mensagens.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        decorrido = timezone.now() - mensagem.created_at

        if decorrido > self.PRAZO_EXCLUSAO:
            return Response(
                {
                    'detail': 'O prazo para apagar esta mensagem terminou. '
                              'Mensagens podem ser removidas em até 3 minutos '
                              'após o envio.'
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if mensagem.solicitacoes.exists():
            return Response(
                {
                    'detail': 'Esta mensagem foi encaminhada como pedido de '
                              'ajuda e não pode mais ser apagada.'
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        mensagem.deleted_at = timezone.now()
        mensagem.save(update_fields=['deleted_at'])

        # Quem esta com a conversa aberta precisa ver a mensagem sumir. Sem
        # isso, ela continuaria na tela do outro participante ate o proximo
        # recarregamento — e o remetente acreditaria ter apagado algo que
        # continua a vista.
        services.anunciar_exclusao(mensagem)

        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='pedir-ajuda')
    def pedir_ajuda(self, request, pk=None):
        """
        Marca a mensagem como duvida e encaminha a quem ensina.

        Somente esta mensagem e a descricao saem do grupo. E o unico ponto em
        que conteudo da conversa privada chega ao professor.
        """
        mensagem = get_object_or_404(self.get_queryset(), pk=pk)

        try:
            solicitacao = services.pedir_ajuda(
                mensagem=mensagem,
                solicitante=request.user,
                descricao=request.data.get('descricao', ''),
                destino=request.data.get('destino', 'ambos'),
            )
        except services.RegraDeGrupo as excecao:
            return erro(excecao)

        return Response(
            SolicitacaoAjudaSerializer(solicitacao).data,
            status=status.HTTP_201_CREATED,
        )
