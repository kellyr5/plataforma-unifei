import re
from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError

from autenticacao.models import Usuario


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
