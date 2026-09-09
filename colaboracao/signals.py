"""
Sincronizacao do canal de monitoria com os vinculos da disciplina.

O canal reune professores e monitores de uma materia, e essa composicao muda
sempre que um vinculo e criado, alterado ou removido — quando um aluno e
promovido a monitor, quando a monitoria termina, quando outro professor assume
a turma.

Amarrar a sincronizacao ao sinal, e nao a view que cria o vinculo, cobre todos
os caminhos: a API, o painel administrativo do Django e os comandos de carga
produzem o mesmo efeito. Um canal com participante desatualizado e pior que a
ausencia dele, porque alguem sem vinculo continuaria lendo o que se discute
sobre uma turma que nao acompanha mais.
"""

from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from forum.models import PermissaoDisciplina


def _sincronizar(disciplina):
    """
    Roda depois que a transacao fecha.

    Durante ela, a consulta aos vinculos enxergaria um estado intermediario —
    o vinculo recem-criado pode ainda nao estar visivel — e o canal nasceria
    sem o participante que motivou a chamada.
    """
    from colaboracao import services

    transaction.on_commit(
        lambda: services.garantir_canal_de_monitoria(disciplina)
    )


@receiver(post_save, sender=PermissaoDisciplina)
def vinculo_salvo(sender, instance, **kwargs):
    # Papel de aluno nao compoe o canal, mas a mudanca pode ser justamente a
    # saida de alguem que era monitor. Sincronizar de qualquer forma custa uma
    # consulta e evita o caso em que o rebaixamento passa despercebido.
    _sincronizar(instance.disciplina)


@receiver(post_delete, sender=PermissaoDisciplina)
def vinculo_removido(sender, instance, **kwargs):
    _sincronizar(instance.disciplina)
