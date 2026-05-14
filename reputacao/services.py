"""
Servico de calculo de reputacao.

Centraliza a logica de pontuacao (modelo Stack Overflow) e oferece
funcoes para recalculo incremental (via signals) e recalculo total
(via comando de management).
"""

from django.db import transaction
from django.db.models import Count, Q

from forum.models import Post, Voto, Disciplina
from reputacao.models import (
    UsuarioDisciplinaReputacao,
    PONTOS_VOTO_TOPICO,
    PONTOS_VOTO_RESPOSTA,
    PONTOS_MELHOR_RESPOSTA,
)


def calcular_reputacao_usuario_disciplina(usuario, disciplina):
    """
    Calcula (do zero) a reputacao de um usuario em uma disciplina.

    Pontuacao (modelo Stack Overflow):
    - Voto positivo em topico criado: +5
    - Voto positivo em resposta criada: +10
    - Resposta marcada como melhor: +15

    Retorna um dicionario com pontos e metricas detalhadas.
    """
    # Posts do usuario nesta disciplina (nao deletados)
    posts_usuario = Post.objects.filter(
        autor=usuario,
        disciplina=disciplina,
        deleted_at__isnull=True,
    )

    topicos = posts_usuario.filter(post_pai__isnull=True)
    respostas = posts_usuario.filter(post_pai__isnull=False)

    total_topicos = topicos.count()
    total_respostas = respostas.count()

    # Votos recebidos em topicos
    votos_topicos = Voto.objects.filter(post__in=topicos).count()

    # Votos recebidos em respostas
    votos_respostas = Voto.objects.filter(post__in=respostas).count()

    # Respostas marcadas como melhor
    melhores_respostas = respostas.filter(e_melhor=True).count()

    # Calculo dos pontos
    pontos = (
        votos_topicos * PONTOS_VOTO_TOPICO
        + votos_respostas * PONTOS_VOTO_RESPOSTA
        + melhores_respostas * PONTOS_MELHOR_RESPOSTA
    )

    return {
        'pontos': pontos,
        'total_posts': total_topicos,
        'total_respostas': total_respostas,
        'total_votos_recebidos': votos_topicos + votos_respostas,
        'total_melhores_respostas': melhores_respostas,
    }


@transaction.atomic
def atualizar_reputacao(usuario, disciplina):
    """
    Recalcula e persiste a reputacao de um usuario em uma disciplina.

    Cria o registro se nao existir (get_or_create), garantindo que o
    par (usuario, disciplina) seja sempre unico.
    """
    metricas = calcular_reputacao_usuario_disciplina(usuario, disciplina)

    reputacao, _ = UsuarioDisciplinaReputacao.objects.update_or_create(
        usuario=usuario,
        disciplina=disciplina,
        defaults=metricas,
    )
    return reputacao


def recalcular_tudo():
    """
    Recalcula a reputacao de todos os usuarios em todas as disciplinas.

    Util para popular a reputacao inicial ou corrigir inconsistencias.
    Retorna o numero de registros de reputacao processados.
    """
    # Identifica todos os pares (autor, disciplina) que tem ao menos um post
    pares = Post.objects.filter(
        deleted_at__isnull=True
    ).values_list('autor', 'disciplina').distinct()

    total = 0
    for usuario_id, disciplina_id in pares:
        from autenticacao.models import Usuario
        usuario = Usuario.objects.get(id=usuario_id)
        disciplina = Disciplina.objects.get(id=disciplina_id)
        atualizar_reputacao(usuario, disciplina)
        total += 1

    return total
