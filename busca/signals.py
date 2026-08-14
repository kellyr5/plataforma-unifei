"""
Manutencao do indice conforme o forum muda.

A indexacao roda depois do commit, e nao dentro dele. Gerar um embedding leva
algumas centenas de milissegundos, e prender a transacao do banco durante esse
tempo transformaria cada publicacao numa espera perceptivel — alem de segurar
uma conexao do pool por um trabalho que nao e de banco.

Fica desligada por padrao. Os testes e o `migrate` nao devem carregar um modelo
de aprendizado de maquina, e quem roda a plataforma sem a busca semantica nao
precisa nem instalar a biblioteca. Para ativar, no .env:

    BUSCA_SEMANTICA_ATIVA=True
"""

import logging

from django.conf import settings
from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from forum.models import Post


logger = logging.getLogger(__name__)


@receiver(post_save, sender=Post)
def indexar_publicacao(sender, instance, **kwargs):
    """Reindexa a publicacao salva, se a busca semantica estiver ativa."""
    if not getattr(settings, 'BUSCA_SEMANTICA_ATIVA', False):
        return

    # Publicacao removida por moderacao sai do indice: o que nao aparece no
    # forum tambem nao pode aparecer na busca.
    if instance.deleted_at is not None:
        transaction.on_commit(lambda: _remover(instance))
        return

    transaction.on_commit(lambda: _indexar(instance))


def _indexar(post):
    from busca.services import indexar_post

    try:
        indexar_post(post)
    except Exception as erro:  # noqa: BLE001
        # O indice e recurso adicional: falhar aqui nao pode derrubar nada.
        logger.warning('Indexacao do post %s falhou: %s', post.id, erro)


def _remover(post):
    from busca.models import IndicePost

    IndicePost.objects.filter(post=post).delete()
