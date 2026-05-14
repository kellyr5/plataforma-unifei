"""
Signals de auditoria para o modulo de voluntariado.

Mantido em arquivo separado de signals.py para organizacao: o arquivo
principal cobre auth/forum, este cobre voluntariado. Ambos sao
registrados no apps.py.
"""

from django.db.models.signals import post_save
from django.dispatch import receiver

from voluntariado.models import Oportunidade, InscricaoVoluntariado, Certificado
from auditoria.services import registrar_acao, serializar_objeto


# Cache de status anteriores para detectar transicoes de inscricao
_cache_status_inscricao = {}


@receiver(post_save, sender=Oportunidade)
def auditar_oportunidade_criada(sender, instance, created, **kwargs):
    """Audita a criacao de uma oportunidade de voluntariado."""
    if created:
        registrar_acao(
            acao='oportunidade_criada',
            objeto_afetado=instance,
            dados_novos=serializar_objeto(instance),
            descricao=(
                f'Oportunidade de voluntariado criada: "{instance.titulo}" '
                f'por {instance.organizacao.nome_completo}'
            ),
        )


@receiver(post_save, sender=InscricaoVoluntariado)
def auditar_inscricao_voluntariado(sender, instance, created, **kwargs):
    """Audita criacao e mudancas de status de inscricoes em voluntariado."""
    if created:
        registrar_acao(
            acao='inscricao_voluntariado',
            objeto_afetado=instance,
            dados_novos=serializar_objeto(instance),
            descricao=(
                f'{instance.estudante.nome_completo} se inscreveu em '
                f'"{instance.oportunidade.titulo}" (status inicial: {instance.status})'
            ),
        )
        return

    # Mapeia transicoes de status para acoes de auditoria
    mapa_acoes = {
        'aprovada': 'inscricao_aprovada',
        'rejeitada': 'inscricao_rejeitada',
        'removida': 'inscricao_removida',
        'concluida': 'voluntariado_concluido',
    }

    acao = mapa_acoes.get(instance.status)
    if not acao:
        return

    descricoes = {
        'inscricao_aprovada': (
            f'Inscricao de {instance.estudante.nome_completo} em '
            f'"{instance.oportunidade.titulo}" foi aprovada'
        ),
        'inscricao_rejeitada': (
            f'Inscricao de {instance.estudante.nome_completo} em '
            f'"{instance.oportunidade.titulo}" foi rejeitada. '
            f'Motivo: {instance.motivo_decisao}'
        ),
        'inscricao_removida': (
            f'{instance.estudante.nome_completo} foi removido de '
            f'"{instance.oportunidade.titulo}". Motivo: {instance.motivo_decisao}'
        ),
        'voluntariado_concluido': (
            f'Participacao de {instance.estudante.nome_completo} em '
            f'"{instance.oportunidade.titulo}" concluida com '
            f'{instance.horas_realizadas} hora(s)'
        ),
    }

    registrar_acao(
        acao=acao,
        objeto_afetado=instance,
        dados_novos=serializar_objeto(instance),
        descricao=descricoes.get(acao, ''),
    )
