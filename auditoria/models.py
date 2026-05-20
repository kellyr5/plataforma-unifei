"""
Model de Auditoria.

Registros sao imutaveis (so INSERT e SELECT, nunca UPDATE ou DELETE).
Aplicado para conformidade com LGPD/GDPR (direito de auditoria) e
SOC 2 (rastreabilidade de acoes em sistemas).
"""

import uuid
from django.conf import settings
from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType


class AuditLog(models.Model):
    """
    Registro imutavel de uma acao realizada no sistema.

    Captura o contexto completo: quem, quando, o que, onde, com quais
    dados antes e depois, de qual IP e User-Agent. Snapshots em JSON
    permitem reconstruir o estado do objeto no momento da acao.
    """

    ACAO_CHOICES = [
        # Auth
        ('login', 'Login'),
        ('logout', 'Logout'),
        ('registro', 'Registro de novo usuario'),
        ('ativacao', 'Ativacao de conta'),

        # Admin
        ('disciplina_criada', 'Disciplina criada'),
        ('permissao_disciplina_alterada', 'Permissao em disciplina alterada'),

        # Forum
        ('post_criado', 'Post criado'),
        ('post_editado', 'Post editado'),
        ('post_removido', 'Post removido'),
        ('marcou_melhor', 'Marcou resposta como melhor'),
        ('desmarcou_melhor', 'Desmarcou melhor resposta'),
        ('denunciou', 'Denunciou conteudo'),

        # Voluntariado
        ('oportunidade_criada', 'Oportunidade de voluntariado criada'),
        ('inscricao_voluntariado', 'Inscricao em oportunidade de voluntariado'),
        ('inscricao_aprovada', 'Inscricao em voluntariado aprovada'),
        ('inscricao_rejeitada', 'Inscricao em voluntariado rejeitada'),
        ('inscricao_removida', 'Participante removido de oportunidade'),
        ('voluntariado_concluido', 'Voluntariado concluido e certificado emitido'),

        # Reputacao
        ('ranking_semestral_gerado', 'Ranking semestral gerado'),

        # Moderacao
        ('denuncia_resolvida', 'Denuncia resolvida'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='acoes_auditadas',
        help_text='Usuario que executou a acao (nulo se anonimo ou usuario removido)',
    )
    acao = models.CharField(max_length=50, choices=ACAO_CHOICES, db_index=True)

    # GenericForeignKey para o objeto afetado
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    objeto_id = models.UUIDField(null=True, blank=True)
    objeto_afetado = GenericForeignKey('content_type', 'objeto_id')

    # Snapshots em JSON (estado antes e depois da acao)
    dados_anteriores = models.JSONField(null=True, blank=True)
    dados_novos = models.JSONField(null=True, blank=True)

    # Contexto da requisicao (LGPD/SOC 2)
    ip_origem = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, default='')

    # Descricao livre opcional (para acoes complexas)
    descricao = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'audit_log'
        verbose_name = 'Registro de Auditoria'
        verbose_name_plural = 'Registros de Auditoria'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['usuario', '-created_at']),
            models.Index(fields=['acao', '-created_at']),
            models.Index(fields=['content_type', 'objeto_id']),
        ]

    def __str__(self):
        usuario_repr = self.usuario.cpf if self.usuario else 'sistema'
        return f'[{self.created_at:%Y-%m-%d %H:%M}] {usuario_repr}: {self.acao}'

    def save(self, *args, **kwargs):
        """
        Imutabilidade: impede atualizacao de registros existentes.

        Aplicado para conformidade com SOC 2 (registros nao adulteraveis)
        e LGPD (integridade do log de auditoria).
        """
        if not self._state.adding:
            raise ValueError(
                'AuditLog e imutavel. Registros nao podem ser atualizados.'
            )
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        """Imutabilidade: impede a exclusao de registros."""
        raise ValueError(
            'AuditLog e imutavel. Registros nao podem ser deletados.'
        )
