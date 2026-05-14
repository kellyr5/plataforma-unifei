"""
Signals que recalculam a reputacao em tempo real.

Sempre que um evento que afeta pontuacao acontece (voto criado/removido,
resposta marcada/desmarcada como melhor), a reputacao do autor do post
naquela disciplina e recalculada automaticamente.

Esta e a parte "tempo real" da estrategia hibrida; o recalculo total
fica disponivel via comando de management.
"""

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from forum.models import Voto, Post
from reputacao.services import atualizar_reputacao


@receiver(post_save, sender=Voto)
def reputacao_ao_criar_voto(sender, instance, created, **kwargs):
    """Recalcula a reputacao do autor do post quando recebe um voto."""
    if created:
        post = instance.post
        atualizar_reputacao(post.autor, post.disciplina)


@receiver(post_delete, sender=Voto)
def reputacao_ao_remover_voto(sender, instance, **kwargs):
    """Recalcula a reputacao do autor do post quando um voto e removido."""
    try:
        post = instance.post
        atualizar_reputacao(post.autor, post.disciplina)
    except Post.DoesNotExist:
        # Post pode ter sido deletado em cascata; nada a recalcular
        pass


@receiver(post_save, sender=Post)
def reputacao_ao_marcar_melhor(sender, instance, created, **kwargs):
    """Recalcula a reputacao quando uma resposta e marcada/desmarcada como melhor."""
    if created:
        return

    update_fields = kwargs.get('update_fields')
    if update_fields and 'e_melhor' in update_fields:
        atualizar_reputacao(instance.autor, instance.disciplina)
