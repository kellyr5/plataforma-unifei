import re
from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from autenticacao.models import Usuario
from autenticacao.tokens import esta_invalidado, invalidar


def cpf_apenas_numeros(cpf):
    """Remove pontos, hifens e espacos do CPF."""
    return re.sub(r'\D', '', cpf or '')


class RegistroSerializer(serializers.Serializer):
    """
    Serializer de registro de novo usuario.

    Aceita CPF com ou sem mascara. Aplica validacoes de senha forte do Django.
    Cria o usuario com ativo=False; a ativacao acontece via codigo enviado por email.
    """

    cpf = serializers.CharField(max_length=14)
    email = serializers.EmailField()
    nome_completo = serializers.CharField(max_length=255)
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)

    def validate_cpf(self, value):
        cpf = cpf_apenas_numeros(value)
        if len(cpf) != 11:
            raise serializers.ValidationError('CPF deve ter 11 digitos.')
        if Usuario.objects.filter(cpf=cpf).exists():
            raise serializers.ValidationError('Este CPF ja esta cadastrado.')
        return cpf

    def validate_email(self, value):
        email = value.lower().strip()
        if Usuario.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError('Este email ja esta cadastrado.')
        return email

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({
                'password_confirm': 'As senhas nao conferem.'
            })
        return data

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')

        usuario = Usuario(**validated_data)
        usuario.set_password(password)
        usuario.ativo = False  # Sera ativado apos validar o codigo
        usuario.save()
        return usuario


class AtivacaoSerializer(serializers.Serializer):
    """Serializer para ativacao de conta via codigo OTP."""

    email = serializers.EmailField()
    codigo = serializers.CharField(max_length=6, min_length=6)


class ReenvioCodigoSerializer(serializers.Serializer):
    """Serializer para reenvio de codigo de ativacao."""

    email = serializers.EmailField()


class RefreshComListaRedisSerializer(TokenRefreshSerializer):
    """
    Renovacao de acesso com invalidacao do refresh token no Redis.

    O SimpleJWT rotaciona o token, ou seja, devolve um refresh novo a cada
    renovacao. Sem invalidar o antigo, ele continuaria valido ate expirar, e
    quem o tivesse interceptado poderia usa-lo em paralelo. Aqui o token
    apresentado e recusado se ja constar na lista, e passa a constar assim que
    a rotacao acontece.
    """

    def validate(self, attrs):
        token_apresentado = RefreshToken(attrs['refresh'])

        if esta_invalidado(token_apresentado):
            raise InvalidToken(
                'Este refresh token ja foi utilizado. Faca login novamente.'
            )

        dados = super().validate(attrs)
        invalidar(token_apresentado)

        return dados


class UsuarioResumoSerializer(serializers.ModelSerializer):
    """Dados minimos para escolher uma pessoa numa lista de atribuicao."""

    class Meta:
        model = Usuario
        fields = ['id', 'nome_completo', 'cpf', 'matricula', 'email', 'ativo']


class PreCadastroSerializer(serializers.Serializer):
    """
    Pre-cadastro feito pela coordenacao, no modelo do SIGAA.

    A conta nasce inativa e sem senha utilizavel. Quem verificou o vinculo
    institucional foi a coordenacao, mas a pessoa ainda precisa provar que
    controla o email informado, e isso acontece no primeiro acesso, pelo mesmo
    fluxo de ativacao por codigo que os demais usuarios ja usam. Assim nao
    existe senha provisoria circulando por terceiros.
    """

    nome_completo = serializers.CharField(max_length=255)
    cpf = serializers.CharField(max_length=14)
    email = serializers.EmailField()
    matricula = serializers.CharField(max_length=20, allow_blank=True, required=False)

    disciplina = serializers.UUIDField(required=False, allow_null=True)
    papel = serializers.ChoiceField(
        choices=['aluno', 'monitor', 'professor'],
        required=False,
    )

    def validate_cpf(self, value):
        cpf = cpf_apenas_numeros(value)

        if len(cpf) != 11:
            raise serializers.ValidationError('CPF deve ter 11 digitos.')

        return cpf

    def validate(self, data):
        if data.get('disciplina') and not data.get('papel'):
            raise serializers.ValidationError({
                'papel': 'Informe o papel ao vincular a pessoa a uma disciplina.'
            })

        return data


class LogoutSerializer(serializers.Serializer):
    """Recebe o refresh token que sera invalidado no encerramento da sessao."""

    refresh = serializers.CharField()
