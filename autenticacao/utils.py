"""
Utilitarios de autenticacao: geracao e validacao de codigos OTP.

Boas praticas implementadas:
- Codigos numericos de 6 digitos (legibilidade e facilidade de digitacao)
- Hash do codigo no banco (nunca armazenar em texto puro)
- Expiracao configuravel (default 30 min)
- Limite de tentativas (anti-brute-force)
"""

import secrets
from datetime import timedelta
from django.conf import settings
from django.contrib.auth.hashers import make_password, check_password
from django.core.mail import send_mail
from django.utils import timezone

from autenticacao.models import CodigoAtivacao


def gerar_codigo_numerico(tamanho=6):
    """
    Gera um codigo numerico aleatorio criptograficamente seguro.

    Usa secrets em vez de random porque secrets e adequado para fins
    de seguranca (nao previsivel mesmo conhecendo a seed).
    """
    return ''.join(str(secrets.randbelow(10)) for _ in range(tamanho))


def criar_codigo_ativacao(usuario, tipo='ativacao'):
    """
    Cria um novo codigo de ativacao para o usuario.

    Invalida codigos pendentes anteriores do mesmo tipo. Retorna uma
    tupla (codigo_em_texto_puro, instancia_do_codigo). O texto puro
    e usado apenas para envio por email; no banco fica apenas o hash.
    """
    # Invalida codigos pendentes anteriores do mesmo tipo
    CodigoAtivacao.objects.filter(
        usuario=usuario,
        tipo=tipo,
        utilizado=False,
    ).update(utilizado=True)

    codigo_texto = gerar_codigo_numerico()
    codigo_hash = make_password(codigo_texto)

    validade = settings.CODIGO_ATIVACAO_VALIDADE_MINUTOS
    data_expiracao = timezone.now() + timedelta(minutes=validade)

    codigo_obj = CodigoAtivacao.objects.create(
        usuario=usuario,
        codigo=codigo_hash,
        tipo=tipo,
        data_expiracao=data_expiracao,
    )

    return codigo_texto, codigo_obj


def enviar_email_ativacao(usuario, codigo_texto):
    """Envia o codigo de ativacao para o email do usuario."""
    assunto = 'Plataforma UNIFEI - Codigo de Ativacao'
    validade = settings.CODIGO_ATIVACAO_VALIDADE_MINUTOS
    corpo = (
        f'Ola, {usuario.nome_completo}!\n\n'
        f'Seu codigo de ativacao da Plataforma UNIFEI e: {codigo_texto}\n\n'
        f'Esse codigo expira em {validade} minutos.\n\n'
        f'Se voce nao solicitou este cadastro, ignore esta mensagem.\n\n'
        f'--\n'
        f'Plataforma UNIFEI'
    )

    send_mail(
        subject=assunto,
        message=corpo,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[usuario.email],
        fail_silently=False,
    )


def validar_codigo_ativacao(usuario, codigo_texto, tipo='ativacao'):
    """
    Valida um codigo de ativacao informado pelo usuario.

    Retorna uma tupla (sucesso, mensagem_erro). Em caso de sucesso,
    a mensagem_erro e None. Incrementa o contador de tentativas em
    cada validacao falha; ao atingir o limite, invalida o codigo.
    """
    codigo_obj = CodigoAtivacao.objects.filter(
        usuario=usuario,
        tipo=tipo,
        utilizado=False,
    ).order_by('-created_at').first()

    if not codigo_obj:
        return False, 'Nenhum codigo ativo encontrado. Solicite um novo codigo.'

    # Verifica expiracao
    if timezone.now() > codigo_obj.data_expiracao:
        codigo_obj.utilizado = True
        codigo_obj.save(update_fields=['utilizado'])
        return False, 'Codigo expirado. Solicite um novo codigo.'

    # Verifica limite de tentativas
    max_tentativas = settings.CODIGO_ATIVACAO_MAX_TENTATIVAS
    if codigo_obj.tentativas >= max_tentativas:
        codigo_obj.utilizado = True
        codigo_obj.save(update_fields=['utilizado'])
        return False, 'Limite de tentativas atingido. Solicite um novo codigo.'

    # Verifica o codigo
    if not check_password(codigo_texto, codigo_obj.codigo):
        codigo_obj.tentativas += 1
        codigo_obj.save(update_fields=['tentativas'])
        restantes = max_tentativas - codigo_obj.tentativas
        return False, f'Codigo invalido. Voce tem {restantes} tentativa(s) restante(s).'

    # Sucesso: marca como utilizado
    codigo_obj.utilizado = True
    codigo_obj.save(update_fields=['utilizado'])
    return True, None
