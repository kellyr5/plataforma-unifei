"""
Signals que disparam notificacoes automaticas para os 7 eventos do sistema.

Vantagem desta arquitetura: as views do forum permanecem inalteradas.
Toda a logica de notificacao fica centralizada aqui, facilitando manutencao
e debug.

Eventos cobertos:
1. Nova resposta em topico
2. Voto recebido em post
3. Resposta marcada como melhor
4. Reacao "duvida persiste" recebida
5. Denuncia resolvida
6. Post removido por moderacao
7. Adicionado como monitor/professor de disciplina
"""

from django.db.models.signals import post_save
from django.dispatch import receiver

from forum.models import (
    Post, Voto, ReacaoPersiste,
    AlertaConteudo, PermissaoDisciplina,
)
from notificacoes.services import criar_notificacao


@receiver(post_save, sender=Post)
def notificar_nova_resposta(sender, instance, created, **kwargs):
    """Evento 1: notifica autor do topico quando alguem responde."""
    if not created or instance.post_pai is None:
        return

    topico = instance.post_pai
    criar_notificacao(
        destinatario=topico.autor,
        remetente=instance.autor,
        tipo='nova_resposta',
        titulo=f'{instance.autor.nome_completo} respondeu seu topico',
        mensagem=f'Nova resposta em "{topico.titulo}".',
        objeto_relacionado=topico,
    )


@receiver(post_save, sender=Voto)
def notificar_voto_recebido(sender, instance, created, **kwargs):
    """Evento 2: notifica autor do post quando recebe um voto positivo."""
    if not created:
        return

    post = instance.post
    titulo_post = post.titulo if post.titulo else 'sua resposta'

    criar_notificacao(
        destinatario=post.autor,
        remetente=instance.usuario,
        tipo='voto_recebido',
        titulo=f'{instance.usuario.nome_completo} votou em seu post',
        mensagem=f'Seu post "{titulo_post}" recebeu um novo voto positivo.',
        objeto_relacionado=post,
    )


@receiver(post_save, sender=Post)
def notificar_melhor_resposta(sender, instance, created, **kwargs):
    """Evento 3: notifica autor da resposta quando ela e marcada como melhor."""
    if created or not instance.e_melhor:
        return

    # Verifica se 'e_melhor' acabou de ser ativado (estava False antes)
    update_fields = kwargs.get('update_fields')
    if update_fields and 'e_melhor' not in update_fields:
        return

    topico = instance.post_pai
    if not topico:
        return  # Topicos nao podem ser melhor resposta

    criar_notificacao(
        destinatario=instance.autor,
        tipo='melhor_resposta',
        titulo='Sua resposta foi marcada como melhor!',
        mensagem=f'Sua resposta em "{topico.titulo}" foi escolhida como melhor.',
        objeto_relacionado=topico,
    )


@receiver(post_save, sender=ReacaoPersiste)
def notificar_reacao_persiste(sender, instance, created, **kwargs):
    """Evento 4: notifica autor da resposta sobre reacao 'duvida persiste'."""
    if not created:
        return

    resposta = instance.post
    topico = resposta.post_pai
    if not topico:
        return

    mensagem = f'Um usuario marcou que sua resposta em "{topico.titulo}" nao resolveu a duvida.'
    if instance.comentario:
        mensagem += f' Comentario: "{instance.comentario}"'

    criar_notificacao(
        destinatario=resposta.autor,
        remetente=instance.usuario,
        tipo='reacao_persiste',
        titulo='Sua resposta recebeu uma reacao "duvida persiste"',
        mensagem=mensagem,
        objeto_relacionado=resposta,
    )


@receiver(post_save, sender=AlertaConteudo)
def notificar_eventos_denuncia(sender, instance, created, **kwargs):
    """
    Evento 5: notifica denunciante quando sua denuncia e resolvida.
    Evento 6: notifica autor do post quando seu post e removido por procedencia.
    """
    if created:
        return

    update_fields = kwargs.get('update_fields')
    if update_fields and 'status' not in update_fields:
        return

    if instance.status not in ['procedente', 'improcedente']:
        return

    # Evento 5: notificar quem denunciou
    decisao_legivel = instance.get_status_display()
    criar_notificacao(
        destinatario=instance.denunciante,
        remetente=instance.resolvido_por,
        tipo='denuncia_resolvida',
        titulo=f'Sua denuncia foi avaliada como {decisao_legivel}',
        mensagem=f'A moderacao analisou sua denuncia. Resolucao: {instance.resolucao}',
        objeto_relacionado=instance.post,
    )

    # Evento 6: se procedente, notifica o autor do post removido
    if instance.status == 'procedente':
        criar_notificacao(
            destinatario=instance.post.autor,
            remetente=instance.resolvido_por,
            tipo='post_removido',
            titulo='Seu post foi removido por moderacao',
            mensagem=(
                f'Seu post foi analisado pela moderacao e removido. '
                f'Motivo: {instance.resolucao}'
            ),
            objeto_relacionado=instance.post,
        )


@receiver(post_save, sender=PermissaoDisciplina)
def notificar_papel_disciplina(sender, instance, created, **kwargs):
    """Evento 7: notifica usuario quando recebe papel monitor/professor em disciplina."""
    if not created:
        return

    if instance.papel not in ['monitor', 'professor']:
        return  # So notifica papeis especiais, nao alunos

    papel_legivel = instance.get_papel_display()
    criar_notificacao(
        destinatario=instance.usuario,
        tipo='papel_disciplina',
        titulo=f'Voce foi adicionado como {papel_legivel}',
        mensagem=(
            f'Voce agora e {papel_legivel} da disciplina '
            f'{instance.disciplina.codigo} - {instance.disciplina.nome}.'
        ),
        objeto_relacionado=instance.disciplina,
    )
