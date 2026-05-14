"""
Signals que disparam notificacoes automaticas para eventos do voluntariado.

Eventos cobertos:
1. Inscricao aprovada (notifica estudante)
2. Inscricao rejeitada (notifica estudante)
3. Inscricao removida pela ONG (notifica estudante)
4. Inscricao concluida com certificado emitido (notifica estudante)
"""

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from voluntariado.models import InscricaoVoluntariado
from notificacoes.services import criar_notificacao


_cache_status_anteriores = {}


@receiver(pre_save, sender=InscricaoVoluntariado)
def cache_status_anterior(sender, instance, **kwargs):
    """Captura o status anterior da inscricao para detectar transicoes."""
    if instance.pk:
        try:
            anterior = InscricaoVoluntariado.objects.get(pk=instance.pk)
            _cache_status_anteriores[instance.pk] = anterior.status
        except InscricaoVoluntariado.DoesNotExist:
            pass


@receiver(post_save, sender=InscricaoVoluntariado)
def notificar_mudancas_de_status(sender, instance, created, **kwargs):
    """Dispara notificacao quando o status da inscricao muda."""
    status_anterior = _cache_status_anteriores.pop(instance.pk, None)

    # Sem mudanca de status, nada a fazer
    if status_anterior == instance.status:
        return

    op = instance.oportunidade
    organizacao = op.organizacao
    estudante = instance.estudante

    if instance.status == 'aprovada' and status_anterior == 'pendente':
        criar_notificacao(
            destinatario=estudante,
            remetente=instance.avaliado_por or organizacao,
            tipo='nova_resposta',
            titulo=f'Inscricao aprovada: {op.titulo}',
            mensagem=(
                f'Sua inscricao em "{op.titulo}" foi aprovada por '
                f'{organizacao.nome_completo}.'
            ),
            objeto_relacionado=op,
        )

    elif instance.status == 'rejeitada':
        criar_notificacao(
            destinatario=estudante,
            remetente=instance.avaliado_por or organizacao,
            tipo='nova_resposta',
            titulo=f'Inscricao nao aprovada: {op.titulo}',
            mensagem=(
                f'Sua inscricao em "{op.titulo}" nao foi aprovada. '
                f'Motivo: {instance.motivo_decisao or "Nao informado"}.'
            ),
            objeto_relacionado=op,
        )

    elif instance.status == 'removida':
        criar_notificacao(
            destinatario=estudante,
            remetente=instance.avaliado_por or organizacao,
            tipo='nova_resposta',
            titulo=f'Voce foi removido da oportunidade: {op.titulo}',
            mensagem=(
                f'Voce foi removido da oportunidade "{op.titulo}". '
                f'Motivo: {instance.motivo_decisao or "Nao informado"}.'
            ),
            objeto_relacionado=op,
        )

    elif instance.status == 'concluida':
        criar_notificacao(
            destinatario=estudante,
            remetente=instance.avaliado_por or organizacao,
            tipo='nova_resposta',
            titulo=f'Voluntariado concluido: {op.titulo}',
            mensagem=(
                f'Sua participacao em "{op.titulo}" foi concluida com '
                f'{instance.horas_realizadas} hora(s). '
                f'Seu certificado ja esta disponivel.'
            ),
            objeto_relacionado=op,
        )
