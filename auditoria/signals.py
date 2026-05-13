"""
Signals que registram acoes auditaveis automaticamente.

Cobertura dos eventos definidos no escopo do TCC:
- Auth: registro, ativacao
- Forum: criacao/edicao/remocao de posts
- Forum: marcacao de melhor resposta
- Forum: criacao de denuncia
- Moderacao: resolucao de denuncia (procedente/improcedente)
- Admin: criacao de disciplina, permissao alterada

Login/logout sao auditados em handler especifico via signal do Django.
"""

from django.contrib.auth.signals import user_logged_in, user_logged_out
from django.db.models.signals import post_save, pre_delete, pre_save
from django.dispatch import receiver

from autenticacao.models import Usuario
from forum.models import (
    Post, Disciplina, AlertaConteudo, PermissaoDisciplina,
)
from auditoria.services import registrar_acao, serializar_objeto


# Cache temporario por instancia para guardar o "antes" no pre_save
_cache_estados_anteriores = {}


# ===== Auth =====

@receiver(user_logged_in)
def auditar_login(sender, request, user, **kwargs):
    """Registra login bem-sucedido."""
    registrar_acao(
        acao='login',
        usuario_override=user,
        descricao=f'Usuario {user.cpf} efetuou login.',
    )


@receiver(user_logged_out)
def auditar_logout(sender, request, user, **kwargs):
    """Registra logout."""
    if user:
        registrar_acao(
            acao='logout',
            usuario_override=user,
            descricao=f'Usuario {user.cpf} efetuou logout.',
        )


@receiver(post_save, sender=Usuario)
def auditar_registro_e_ativacao(sender, instance, created, **kwargs):
    """Audita registro de novo usuario e ativacao de conta."""
    if created:
        registrar_acao(
            acao='registro',
            objeto_afetado=instance,
            usuario_override=instance,
            dados_novos=serializar_objeto(instance),
            descricao=f'Novo usuario registrado: {instance.cpf}',
        )
        return

    update_fields = kwargs.get('update_fields')
    if update_fields and 'ativo' in update_fields and instance.ativo:
        registrar_acao(
            acao='ativacao',
            objeto_afetado=instance,
            usuario_override=instance,
            descricao=f'Conta ativada: {instance.cpf}',
        )


# ===== Forum: Disciplina =====

@receiver(post_save, sender=Disciplina)
def auditar_disciplina_criada(sender, instance, created, **kwargs):
    if created:
        registrar_acao(
            acao='disciplina_criada',
            objeto_afetado=instance,
            dados_novos=serializar_objeto(instance),
            descricao=f'Disciplina criada: {instance.codigo} - {instance.nome}',
        )


# ===== Forum: PermissaoDisciplina =====

@receiver(post_save, sender=PermissaoDisciplina)
def auditar_permissao_alterada(sender, instance, created, **kwargs):
    if created:
        registrar_acao(
            acao='permissao_disciplina_alterada',
            objeto_afetado=instance,
            dados_novos=serializar_objeto(instance),
            descricao=(
                f'{instance.usuario.cpf} cadastrado como {instance.papel} '
                f'em {instance.disciplina.codigo}'
            ),
        )


# ===== Forum: Post =====

@receiver(pre_save, sender=Post)
def cache_post_anterior(sender, instance, **kwargs):
    """Captura o estado do post antes do save (para diff em edicoes)."""
    if instance.pk:
        try:
            anterior = Post.objects.get(pk=instance.pk)
            _cache_estados_anteriores[instance.pk] = serializar_objeto(anterior)
        except Post.DoesNotExist:
            pass


@receiver(post_save, sender=Post)
def auditar_post(sender, instance, created, **kwargs):
    if created:
        registrar_acao(
            acao='post_criado',
            objeto_afetado=instance,
            dados_novos=serializar_objeto(instance),
            descricao=(
                f'Post criado em {instance.disciplina.codigo}: '
                f'{instance.titulo or "(resposta)"}'
            ),
        )
        return

    update_fields = kwargs.get('update_fields') or set()
    anterior = _cache_estados_anteriores.pop(instance.pk, None)

    # Soft delete: marcacao de deleted_at
    if 'deleted_at' in update_fields and instance.deleted_at:
        registrar_acao(
            acao='post_removido',
            objeto_afetado=instance,
            dados_anteriores=anterior,
            dados_novos=serializar_objeto(instance),
            descricao=f'Post removido (soft delete): {instance.id}',
        )
        return

    # Marcacao de melhor resposta
    if 'e_melhor' in update_fields:
        if instance.e_melhor:
            registrar_acao(
                acao='marcou_melhor',
                objeto_afetado=instance,
                dados_anteriores=anterior,
                dados_novos=serializar_objeto(instance),
                descricao=f'Resposta marcada como melhor: {instance.id}',
            )
        else:
            registrar_acao(
                acao='desmarcou_melhor',
                objeto_afetado=instance,
                dados_anteriores=anterior,
                dados_novos=serializar_objeto(instance),
                descricao=f'Resposta desmarcada como melhor: {instance.id}',
            )
        return

    # Edicao de conteudo (verificada via diff)
    if anterior and anterior.get('conteudo') != serializar_objeto(instance).get('conteudo'):
        registrar_acao(
            acao='post_editado',
            objeto_afetado=instance,
            dados_anteriores=anterior,
            dados_novos=serializar_objeto(instance),
            descricao=f'Post editado: {instance.id}',
        )


# ===== Forum: AlertaConteudo (denuncias) =====

@receiver(post_save, sender=AlertaConteudo)
def auditar_denuncia(sender, instance, created, **kwargs):
    if created:
        registrar_acao(
            acao='denunciou',
            objeto_afetado=instance,
            dados_novos=serializar_objeto(instance),
            descricao=f'Denuncia registrada para o post {instance.post_id}',
        )
        return

    update_fields = kwargs.get('update_fields') or set()
    if 'status' in update_fields and instance.status in ['procedente', 'improcedente']:
        registrar_acao(
            acao='denuncia_resolvida',
            objeto_afetado=instance,
            dados_novos=serializar_objeto(instance),
            descricao=(
                f'Denuncia {instance.id} resolvida como {instance.status}. '
                f'Resolucao: {instance.resolucao}'
            ),
        )
