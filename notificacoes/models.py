"""
Model de Notificacoes.

Estrutura unificada que suporta multiplos eventos do sistema atraves
de GenericForeignKey, padrao da industria para sistemas de notificacao.
A camada de transporte (REST agora, WebSocket futuramente) consome a
mesma estrutura sem necessidade de refatoracao.
"""

import uuid
from django.conf import settings
from django.db import models
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType


class Notificacao(models.Model):
    """
    Notificacao destinada a um usuario sobre um evento do sistema.

    O campo 'objeto_relacionado' aponta para qualquer instancia
    (Post, Disciplina, AlertaConteudo etc.) via GenericForeignKey,
    permitindo que o frontend monte links contextuais.
    """

    TIPO_CHOICES = [
        ('nova_resposta', 'Nova resposta no seu topico'),
        ('voto_recebido', 'Novo voto no seu post'),
        ('melhor_resposta', 'Sua resposta foi marcada como melhor'),
        ('reacao_persiste', 'Reacao "duvida persiste" na sua resposta'),
        ('denuncia_resolvida', 'Sua denuncia foi resolvida'),
        ('post_removido', 'Seu post foi removido por moderacao'),
        ('papel_disciplina', 'Voce foi adicionado a uma disciplina'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    destinatario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notificacoes',
    )
    remetente = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notificacoes_enviadas',
        help_text='Usuario que originou o evento (pode ser nulo em eventos do sistema)',
    )
    tipo = models.CharField(max_length=30, choices=TIPO_CHOICES, db_index=True)
    titulo = models.CharField(max_length=255)
    mensagem = models.TextField()

    # Generic Foreign Key para qualquer model relacionado
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    objeto_id = models.UUIDField(null=True, blank=True)
    objeto_relacionado = GenericForeignKey('content_type', 'objeto_id')

    lida = models.BooleanField(default=False, db_index=True)
    lida_em = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'notificacao'
        verbose_name = 'Notificacao'
        verbose_name_plural = 'Notificacoes'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['destinatario', 'lida']),
            models.Index(fields=['destinatario', '-created_at']),
        ]

    def __str__(self):
        return f'{self.tipo} para {self.destinatario}'

    def marcar_como_lida(self):
        """Marca a notificacao como lida e registra o timestamp."""
        from django.utils import timezone
        if not self.lida:
            self.lida = True
            self.lida_em = timezone.now()
            self.save(update_fields=['lida', 'lida_em'])
