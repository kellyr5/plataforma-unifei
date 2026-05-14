"""
Models do modulo de reputacao.

Sistema de gameficacao baseado no modelo consolidado do Stack Overflow,
com pontuacao calculada por disciplina (nao global), refletindo que a
expertise de um usuario varia entre areas de conhecimento.
"""

import uuid
from django.conf import settings
from django.db import models


# Constantes de pontuacao (modelo Stack Overflow)
PONTOS_VOTO_TOPICO = 5
PONTOS_VOTO_RESPOSTA = 10
PONTOS_MELHOR_RESPOSTA = 15


class UsuarioDisciplinaReputacao(models.Model):
    """
    Reputacao de um usuario em uma disciplina especifica.

    A pontuacao e calculada a partir das interacoes do usuario naquela
    disciplina: votos recebidos em topicos e respostas, e respostas
    marcadas como melhor. Cada par (usuario, disciplina) e unico.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reputacoes_disciplina',
    )
    disciplina = models.ForeignKey(
        'forum.Disciplina',
        on_delete=models.CASCADE,
        related_name='reputacoes',
    )

    pontos = models.IntegerField(default=0, db_index=True)

    # Metricas detalhadas (cache para exibicao e transparencia)
    total_posts = models.PositiveIntegerField(default=0)
    total_respostas = models.PositiveIntegerField(default=0)
    total_votos_recebidos = models.PositiveIntegerField(default=0)
    total_melhores_respostas = models.PositiveIntegerField(default=0)

    atualizado_em = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'usuario_disciplina_reputacao'
        verbose_name = 'Reputacao por Disciplina'
        verbose_name_plural = 'Reputacoes por Disciplina'
        ordering = ['-pontos']
        constraints = [
            models.UniqueConstraint(
                fields=['usuario', 'disciplina'],
                name='unique_reputacao_usuario_disciplina',
            ),
        ]
        indexes = [
            models.Index(fields=['disciplina', '-pontos']),
        ]

    def __str__(self):
        return f'{self.usuario.nome_completo} - {self.disciplina.codigo}: {self.pontos} pts'


class RankingSemestral(models.Model):
    """
    Snapshot imutavel do ranking de uma disciplina em um semestre.

    Permite preservar rankings historicos mesmo que a pontuacao continue
    evoluindo. Gerado sob demanda por administradores.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    disciplina = models.ForeignKey(
        'forum.Disciplina',
        on_delete=models.CASCADE,
        related_name='rankings_semestrais',
    )
    semestre = models.CharField(max_length=10, help_text='Ex: 2026.1', db_index=True)

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='posicoes_ranking',
    )
    posicao = models.PositiveIntegerField()
    pontos = models.IntegerField()

    # Snapshot do nome (preserva mesmo se o usuario mudar depois)
    nome_usuario = models.CharField(max_length=255)

    gerado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ranking_semestral'
        verbose_name = 'Ranking Semestral'
        verbose_name_plural = 'Rankings Semestrais'
        ordering = ['disciplina', 'semestre', 'posicao']
        constraints = [
            models.UniqueConstraint(
                fields=['disciplina', 'semestre', 'usuario'],
                name='unique_ranking_disciplina_semestre_usuario',
            ),
        ]
        indexes = [
            models.Index(fields=['disciplina', 'semestre', 'posicao']),
        ]

    def __str__(self):
        return (
            f'{self.disciplina.codigo} {self.semestre} - '
            f'{self.posicao}o lugar: {self.nome_usuario} ({self.pontos} pts)'
        )
