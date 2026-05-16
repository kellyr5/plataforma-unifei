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
from autenticacao.api.serializers import (
    RegistroSerializer,
    AtivacaoSerializer,
    ReenvioCodigoSerializer,
)
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
