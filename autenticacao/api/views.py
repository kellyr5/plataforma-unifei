"""
Views de registro, ativacao de conta e reenvio de codigo OTP.

O fluxo segue o padrao OTP-based registration:
1. POST /register/ -- cria usuario inativo, gera codigo, envia email
2. POST /ativar/ -- valida codigo, ativa conta, retorna tokens JWT
3. POST /reenviar-codigo/ -- gera novo codigo se o anterior expirou
"""

from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from drf_spectacular.utils import extend_schema

from autenticacao.models import Usuario
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.views import TokenRefreshView

from autenticacao.api.serializers import (
    RegistroSerializer,
    AtivacaoSerializer,
    ReenvioCodigoSerializer,
    LogoutSerializer,
    RefreshComListaRedisSerializer,
)
from autenticacao.tokens import invalidar
from autenticacao.utils import (
    criar_codigo_ativacao,
    enviar_email_ativacao,
    validar_codigo_ativacao,
)


class RegistroView(APIView):
    """
    POST /api/auth/register/

    Cria um novo usuario com status inativo e dispara o email de ativacao.
    Nao retorna tokens; usuario precisa ativar a conta antes de logar.
    """

    permission_classes = [permissions.AllowAny]

    @extend_schema(
        request=RegistroSerializer,
        responses={201: dict},
        tags=['Autenticacao'],
        summary='Registrar novo usuario',
    )
    def post(self, request):
        serializer = RegistroSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        usuario = serializer.save()

        codigo_texto, _ = criar_codigo_ativacao(usuario, tipo='ativacao')

        try:
            enviar_email_ativacao(usuario, codigo_texto)
        except Exception as e:
            # Em desenvolvimento (console backend) nao deve falhar.
            # Em producao, idealmente enfileirar email com Celery.
            return Response(
                {
                    'detail': 'Cadastro criado, mas houve falha ao enviar o email. '
                              'Use o endpoint /reenviar-codigo/ para tentar novamente.',
                    'erro': str(e),
                },
                status=status.HTTP_201_CREATED,
            )

        return Response(
            {
                'detail': 'Cadastro realizado com sucesso. '
                          'Verifique seu email para o codigo de ativacao.',
                'email': usuario.email,
            },
            status=status.HTTP_201_CREATED,
        )


class AtivacaoView(APIView):
    """
    POST /api/auth/ativar/

    Valida o codigo OTP e ativa a conta do usuario. Em caso de sucesso,
    retorna os tokens JWT (access e refresh) prontos para uso.
    """

    permission_classes = [permissions.AllowAny]

    @extend_schema(
        request=AtivacaoSerializer,
        responses={200: dict},
        tags=['Autenticacao'],
        summary='Ativar conta de usuario',
    )
    
    def post(self, request):
        serializer = AtivacaoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email'].lower().strip()
        codigo = serializer.validated_data['codigo']

        try:
            usuario = Usuario.objects.get(email__iexact=email)
        except Usuario.DoesNotExist:
            # Mensagem generica para nao expor existencia de email no sistema
            return Response(
                {'detail': 'Email ou codigo invalido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if usuario.ativo:
            return Response(
                {'detail': 'Esta conta ja esta ativa. Use o login normalmente.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        sucesso, mensagem_erro = validar_codigo_ativacao(usuario, codigo, tipo='ativacao')

        if not sucesso:
            return Response(
                {'detail': mensagem_erro},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Ativa a conta
        usuario.ativo = True
        usuario.save(update_fields=['ativo'])

        # Gera tokens JWT
        refresh = RefreshToken.for_user(usuario)

        return Response(
            {
                'detail': 'Conta ativada com sucesso.',
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            },
            status=status.HTTP_200_OK,
        )


class ReenvioCodigoView(APIView):
    """
    POST /api/auth/reenviar-codigo/

    Gera um novo codigo de ativacao para usuario ainda inativo.
    Para evitar enumeration attacks (descobrir quais emails estao cadastrados),
    sempre retorna sucesso, mesmo se o email nao existir.
    """

    permission_classes = [permissions.AllowAny]

    @extend_schema(
        request=ReenvioCodigoSerializer,
        responses={200: dict},
        tags=['Autenticacao'],
        summary='Reenviar codigo de ativacao',
    )
    
    def post(self, request):
        serializer = ReenvioCodigoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email'].lower().strip()
        usuario = Usuario.objects.filter(email__iexact=email, ativo=False).first()

        # Importante: sempre retornar a mesma mensagem para evitar enumeration
        resposta_padrao = Response(
            {
                'detail': 'Se o email estiver cadastrado e inativo, '
                          'um novo codigo de ativacao sera enviado.',
            },
            status=status.HTTP_200_OK,
        )

        if not usuario:
            return resposta_padrao

        codigo_texto, _ = criar_codigo_ativacao(usuario, tipo='ativacao')

        try:
            enviar_email_ativacao(usuario, codigo_texto)
        except Exception:
            pass  # Falha silenciosa para nao expor erro ao atacante

        return resposta_padrao


class RefreshView(TokenRefreshView):
    """
    POST /api/auth/refresh/

    Renova o token de acesso e invalida o refresh apresentado, que passa a
    constar na lista mantida no Redis.
    """

    serializer_class = RefreshComListaRedisSerializer


class LogoutView(APIView):
    """
    POST /api/auth/logout/

    Encerra a sessao invalidando o refresh token informado.

    Nao ha como revogar um token de acesso ja emitido, porque ele e validado
    apenas pela assinatura. O que o logout garante e que nenhum acesso novo
    sera emitido a partir daquela sessao, e o acesso em circulacao expira em
    ate uma hora.
    """

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        request=LogoutSerializer,
        responses={205: dict},
        tags=['Autenticacao'],
        summary='Encerrar sessao',
    )
    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            token = RefreshToken(serializer.validated_data['refresh'])
        except TokenError:
            return Response(
                {'detail': 'Refresh token invalido ou ja expirado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        invalidar(token)

        return Response(
            {'detail': 'Sessao encerrada.'},
            status=status.HTTP_205_RESET_CONTENT,
        )


class MeView(APIView):
    """
    GET /api/auth/me/

    Dados do usuario autenticado, incluindo os papeis que ele exerce.

    Os papeis vao juntos de proposito. A interface precisa saber, logo no
    carregamento, se deve exibir a area de moderacao ou as acoes de
    coordenacao, e buscar isso em uma chamada separada por tela produziria
    um piscar de itens aparecendo e sumindo. A permissao continua sendo
    verificada no backend a cada requisicao; isto aqui e apresentacao.
    """

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary='Dados do usuario autenticado',
        responses={200: dict},
        tags=['Autenticacao'],
    )
    def get(self, request):
        from forum.models import PermissaoDisciplina

        u = request.user

        vinculos = list(
            PermissaoDisciplina.objects.filter(usuario=u, ativo=True)
            .select_related('disciplina')
        )

        papeis_disciplina = [
            {
                'disciplina_id': str(v.disciplina_id),
                'disciplina_codigo': v.disciplina.codigo,
                'disciplina_nome': v.disciplina.nome,
                'papel': v.papel,
            }
            for v in vinculos
        ]

        papeis_globais = list(
            u.roles_globais.values_list('role', flat=True)
        )

        e_coordenacao = bool(u.is_admin or u.is_superuser)
        e_monitor = any(v.papel == 'monitor' for v in vinculos)
        e_professor = any(v.papel == 'professor' for v in vinculos)

        return Response({
            'id': str(u.id),
            'nome_completo': u.nome_completo,
            'cpf': u.cpf,
            'email': u.email,
            'is_admin': u.is_admin,
            'bio': u.bio or '',
            'avatar_url': u.avatar_url or '',

            'papeis_globais': papeis_globais,
            'papeis_disciplina': papeis_disciplina,

            # Atalhos usados pela interface para decidir o que exibir.
            'e_coordenacao': e_coordenacao,
            'e_monitor': e_monitor,
            'e_professor': e_professor,
            'e_organizacao': 'ong' in papeis_globais,
            'pode_moderar': e_coordenacao or e_monitor or e_professor,
        })
