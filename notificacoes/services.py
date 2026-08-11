"""
Serviço de notificações.

Centraliza a criação de notificações e isola o resto do sistema dos detalhes
de implementação. Quem dispara um evento chama apenas criar_notificacao(), sem
saber se o aviso vai por banco, por WebSocket ou pelos dois.

A entrega tem duas camadas: o registro no PostgreSQL, que é a fonte da verdade
e sustenta a lista de notificações da tela, e o broadcast pelo Channels, que
faz o aviso aparecer na hora para quem estiver com a plataforma aberta. Uma
falha no broadcast nunca impede a persistência, porque o usuário precisa ver a
notificação ao recarregar a página mesmo que o Redis esteja fora do ar.
"""

import logging
from typing import Optional

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
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
    Cria uma notificação no banco e dispara o broadcast em tempo real.

    Regras de negócio:
    - Não notifica o usuário sobre ações que ele mesmo realizou.
    - Falhas no disparo em tempo real não impedem a persistência no banco.
    """

    # Anti auto-notificação: ninguém precisa ser avisado do que fez.
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
            f'Falha ao disparar notificação em tempo real (id={notificacao.id}): {exc}'
        )

    return notificacao


def _serializar_para_broadcast(notificacao: Notificacao) -> dict:
    """
    Monta o payload enviado pelo WebSocket.

    É um recorte enxuto do serializer REST, com o necessário para o frontend
    montar o item da lista e o link de destino sem uma nova requisição.
    """
    return {
        'id': str(notificacao.id),
        'tipo': notificacao.tipo,
        'titulo': notificacao.titulo,
        'mensagem': notificacao.mensagem,
        'lida': notificacao.lida,
        'created_at': notificacao.created_at.isoformat(),
        'remetente_nome': (
            notificacao.remetente.nome_completo if notificacao.remetente else None
        ),
        'objeto_tipo': (
            notificacao.content_type.model if notificacao.content_type else None
        ),
        'objeto_id': str(notificacao.objeto_id) if notificacao.objeto_id else None,
    }


def _disparar_realtime(notificacao: Notificacao) -> None:
    """
    Publica a notificação no grupo do destinatário.

    O group_send é assíncrono, mas quem chama está numa view síncrona, por isso
    o async_to_sync. Se a camada de canais não estiver configurada, o
    get_channel_layer devolve None e o disparo é silenciosamente ignorado.
    """
    channel_layer = get_channel_layer()

    if channel_layer is None:
        return

    async_to_sync(channel_layer.group_send)(
        f'notificacoes_{notificacao.destinatario_id}',
        {
            'type': 'notificacao.nova',
            'notificacao': _serializar_para_broadcast(notificacao),
        },
    )


def contar_nao_lidas(usuario) -> int:
    """Retorna o número de notificações não lidas de um usuário."""
    return Notificacao.objects.filter(destinatario=usuario, lida=False).count()
