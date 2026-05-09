"""
Servico de notificacoes.

Centraliza a logica de criacao de notificacoes, isolando o resto do
sistema dos detalhes de implementacao. Quando WebSockets forem
implementados (Fase B), basta plugar o broadcast no metodo
_disparar_realtime() sem alterar quem chama o servico.
"""

import logging
from typing import Optional
from django.contrib.contenttypes.models import ContentType
from django.db import models

from notificacoes.models import Notificacao


logger = logging.getLogger(__name__)


def criar_notificacao(
    destinatario,
    tipo: str,
    titulo: str,
    mensagem: str,
    remetente=None,
    objeto_relacionado: Optional[models.Model] = None,
) -> Optional[Notificacao]:
    """
    Cria uma notificacao no banco e dispara o broadcast em tempo real.

    Regras de negocio:
    - Nao notifica o usuario sobre acoes que ele mesmo realizou (auto-eventos).
    - Falhas no disparo realtime nao impedem a persistencia no banco.
    """

    # Anti auto-notificacao: nao notifica o proprio usuario
    if remetente and remetente.id == destinatario.id:
        return None

    notificacao_data = {
        'destinatario': destinatario,
        'tipo': tipo,
        'titulo': titulo,
        'mensagem': mensagem,
        'remetente': remetente,
    }

    if objeto_relacionado:
        notificacao_data['content_type'] = ContentType.objects.get_for_model(
            objeto_relacionado.__class__
        )
        notificacao_data['objeto_id'] = objeto_relacionado.id

    notificacao = Notificacao.objects.create(**notificacao_data)

    try:
        _disparar_realtime(notificacao)
    except Exception as exc:
        logger.warning(
            f'Falha ao disparar notificacao em tempo real (id={notificacao.id}): {exc}'
        )

    return notificacao


def _disparar_realtime(notificacao: Notificacao) -> None:
    """
    Hook para disparo de notificacao em tempo real.

    Implementacao atual: no-op (Fase A, REST polling).

    Quando Django Channels for habilitado (Fase B), substituir por:

        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'notificacoes_{notificacao.destinatario.id}',
            {'type': 'notificacao.nova', 'notificacao_id': str(notificacao.id)},
        )
    """
    pass


def contar_nao_lidas(usuario) -> int:
    """Retorna o numero de notificacoes nao lidas de um usuario."""
    return Notificacao.objects.filter(destinatario=usuario, lida=False).count()
