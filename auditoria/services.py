"""
Servico de auditoria.

Centraliza a logica de criacao de registros de auditoria, com
captura automatica do contexto da requisicao (IP, User-Agent,
usuario autenticado) via thread local.
"""

import logging
from typing import Optional, Any
from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.forms.models import model_to_dict

from auditoria.models import AuditLog
from auditoria.middleware import get_request_contexto


logger = logging.getLogger(__name__)


def serializar_objeto(objeto: Optional[models.Model]) -> Optional[dict]:
    """
    Converte uma instancia de model em dict serializavel para JSON.

    Remove campos sensiveis (password, codigo de ativacao) e converte
    UUIDs/datas para strings.
    """
    if objeto is None:
        return None

    dados = model_to_dict(objeto)

    # Campos sensiveis nunca devem ir para o audit log
    campos_sensiveis = {'password', 'codigo', 'last_login'}
    for campo in campos_sensiveis:
        dados.pop(campo, None)

    # Converte UUIDs e outros tipos nao-serializaveis para string
    for chave, valor in list(dados.items()):
        if hasattr(valor, 'hex') or hasattr(valor, 'isoformat'):
            dados[chave] = str(valor)

    return dados


def registrar_acao(
    acao: str,
    objeto_afetado: Optional[models.Model] = None,
    dados_anteriores: Optional[dict] = None,
    dados_novos: Optional[dict] = None,
    descricao: str = '',
    usuario_override: Any = None,
) -> Optional[AuditLog]:
    """
    Registra uma acao no log de auditoria.

    O usuario, IP e User-Agent sao capturados automaticamente do
    contexto da requisicao via middleware. O parametro usuario_override
    e util quando a acao e disparada fora de um request HTTP (ex: shell).

    Falhas no registro nao devem propagar erro para o caller, para
    nao bloquear a operacao principal do sistema.
    """
    contexto = get_request_contexto()
    usuario = usuario_override or contexto['usuario']

    log_data = {
        'usuario': usuario,
        'acao': acao,
        'dados_anteriores': dados_anteriores,
        'dados_novos': dados_novos,
        'ip_origem': contexto['ip_origem'],
        'user_agent': contexto['user_agent'],
        'descricao': descricao,
    }

    if objeto_afetado:
        log_data['content_type'] = ContentType.objects.get_for_model(
            objeto_afetado.__class__
        )
        log_data['objeto_id'] = objeto_afetado.id

    try:
        return AuditLog.objects.create(**log_data)
    except Exception as exc:
        logger.error(f'Falha ao registrar AuditLog (acao={acao}): {exc}')
        return None
