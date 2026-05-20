"""
Comando de management para recalculo total da reputacao.

Uso:
    python manage.py recalcular_reputacao
"""

from django.core.management.base import BaseCommand

from reputacao.services import recalcular_tudo


class Command(BaseCommand):
    help = 'Recalcula a reputacao de todos os usuarios em todas as disciplinas'

    def handle(self, *args, **options):
        self.stdout.write('Iniciando recalculo total de reputacao...')
        total = recalcular_tudo()
        self.stdout.write(
            self.style.SUCCESS(
                f'Recalculo concluido. {total} registro(s) de reputacao processado(s).'
            )
        )
