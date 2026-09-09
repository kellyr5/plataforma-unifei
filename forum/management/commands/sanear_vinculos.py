"""
Corrige inconsistencias nos vinculos com disciplinas.

Tres comandos povoam a base — criar_perfis_demo, popular_demonstracao e
cadastrar_participantes — e nenhum deles conhece o que os outros ja fizeram.
O resultado aparece no canal da monitoria: disciplinas com varios monitores,
onde o encargo e de uma pessoa por semestre, e pessoas homonimas cadastradas
com CPFs diferentes ocupando o mesmo papel.

Este comando encontra e corrige o que pode ser corrigido com seguranca, e
apenas relata o que exige decisao humana. A distincao importa: desativar o
monitor excedente e reversivel e obedece a uma regra clara; decidir qual de
dois cadastros homonimos e a pessoa real nao e algo que um script deva
arbitrar.

Uso:
    python manage.py sanear_vinculos            # apenas relata
    python manage.py sanear_vinculos --aplicar  # corrige
"""

from collections import defaultdict

from django.core.management.base import BaseCommand
from django.db import transaction

from forum.models import Disciplina, PermissaoDisciplina


class Command(BaseCommand):
    help = 'Encontra e corrige inconsistencias nos vinculos com disciplinas.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--aplicar',
            action='store_true',
            help='Grava as correcoes. Sem esta opcao, apenas relata.',
        )

    def handle(self, *args, **opcoes):
        aplicar = opcoes['aplicar']

        if not aplicar:
            self.stdout.write(self.style.WARNING(
                'Modo de conferencia: nada sera gravado. '
                'Use --aplicar para corrigir.\n'
            ))

        self._monitores_excedentes(aplicar)
        self._homonimos()
        self._vinculos_inativos_no_canal(aplicar)

        if aplicar:
            self._ressincronizar_canais()

    # ------------------------------------------------------------------
    # Monitoria: um por disciplina
    # ------------------------------------------------------------------

    def _monitores_excedentes(self, aplicar):
        self.stdout.write(self.style.MIGRATE_HEADING(
            '\n== Disciplinas com mais de um monitor =='
        ))

        encontrou = False

        for disciplina in Disciplina.objects.all():
            monitores = list(
                PermissaoDisciplina.objects
                .filter(disciplina=disciplina, papel='monitor', ativo=True)
                .select_related('usuario')
                .order_by('created_at')
            )

            if len(monitores) <= 1:
                continue

            encontrou = True
            mantido, *excedentes = monitores

            self.stdout.write(f'\n{disciplina.codigo} — {len(monitores)} monitores')
            self.stdout.write(self.style.SUCCESS(
                f'    mantem: {mantido.usuario.nome_completo} '
                f'({mantido.usuario.cpf}), o mais antigo'
            ))

            for vinculo in excedentes:
                self.stdout.write(self.style.WARNING(
                    f'    volta a aluno: {vinculo.usuario.nome_completo} '
                    f'({vinculo.usuario.cpf})'
                ))

                if aplicar:
                    # Volta a aluno em vez de remover: a pessoa continua
                    # matriculada na disciplina, e apagar o vinculo a tiraria
                    # do forum da turma que ela cursa.
                    vinculo.papel = 'aluno'
                    vinculo.save(update_fields=['papel'])

        if not encontrou:
            self.stdout.write('    Nenhuma. Todas as disciplinas tem no maximo um monitor.')

    # ------------------------------------------------------------------
    # Cadastros duplicados da mesma pessoa
    # ------------------------------------------------------------------

    def _homonimos(self):
        """
        Relata, sem corrigir.

        Dois cadastros com o mesmo nome podem ser a mesma pessoa duplicada por
        cargas diferentes ou duas pessoas homonimas, que existem. Unificar sem
        certeza apagaria o historico de alguem, e por isso o comando apenas
        aponta onde olhar.
        """
        self.stdout.write(self.style.MIGRATE_HEADING(
            '\n== Nomes repetidos entre quem conduz disciplinas =='
        ))

        por_nome = defaultdict(set)

        vinculos = PermissaoDisciplina.objects.filter(
            ativo=True, papel__in=['professor', 'monitor'],
        ).select_related('usuario')

        for vinculo in vinculos:
            por_nome[vinculo.usuario.nome_completo].add(vinculo.usuario)

        repetidos = {
            nome: pessoas for nome, pessoas in por_nome.items()
            if len(pessoas) > 1
        }

        if not repetidos:
            self.stdout.write('    Nenhum.')
            return

        for nome, pessoas in repetidos.items():
            self.stdout.write(self.style.WARNING(f'\n{nome} — {len(pessoas)} cadastros'))

            for pessoa in sorted(pessoas, key=lambda u: u.cpf):
                materias = PermissaoDisciplina.objects.filter(
                    usuario=pessoa, ativo=True,
                ).select_related('disciplina')

                codigos = ', '.join(
                    f'{v.disciplina.codigo}({v.papel})' for v in materias
                ) or 'sem vinculo'

                self.stdout.write(
                    f'    CPF {pessoa.cpf} — {pessoa.email} — {codigos}'
                )

        self.stdout.write(self.style.WARNING(
            '\n    Decida qual cadastro permanece e remova o outro pelo painel '
            'administrativo.\n    O comando nao unifica: se forem duas pessoas '
            'distintas, a fusao apagaria o historico de uma delas.'
        ))

    # ------------------------------------------------------------------
    # Canais com participante sem vinculo
    # ------------------------------------------------------------------

    def _vinculos_inativos_no_canal(self, aplicar):
        """Quem perdeu o vinculo mas continua no canal da monitoria."""
        from colaboracao.models import Conversa

        self.stdout.write(self.style.MIGRATE_HEADING(
            '\n== Participantes sem vinculo ativo no canal da monitoria =='
        ))

        encontrou = False

        for conversa in Conversa.objects.filter(tipo='monitoria').select_related('disciplina'):
            conduzem = set(
                PermissaoDisciplina.objects.filter(
                    disciplina=conversa.disciplina,
                    ativo=True,
                    papel__in=['professor', 'monitor'],
                ).values_list('usuario_id', flat=True)
            )

            sobrando = conversa.participantes.exclude(
                usuario_id__in=conduzem,
            ).select_related('usuario')

            for participante in sobrando:
                encontrou = True
                self.stdout.write(self.style.WARNING(
                    f'    {conversa.disciplina.codigo}: '
                    f'{participante.usuario.nome_completo} sai do canal'
                ))

                if aplicar:
                    participante.delete()

        if not encontrou:
            self.stdout.write('    Nenhum.')

    # ------------------------------------------------------------------

    def _ressincronizar_canais(self):
        """Recompoe os canais a partir dos vinculos ja corrigidos."""
        from colaboracao import services

        self.stdout.write(self.style.MIGRATE_HEADING(
            '\n== Ressincronizando os canais =='
        ))

        with transaction.atomic():
            disciplinas = Disciplina.objects.filter(
                permissoes__papel='monitor', permissoes__ativo=True,
            ).distinct()

            for disciplina in disciplinas:
                canal = services.garantir_canal_de_monitoria(disciplina)

                if canal is None:
                    continue

                nomes = [
                    p.usuario.nome_completo
                    for p in canal.participantes.select_related('usuario')
                ]
                self.stdout.write(
                    f'    {disciplina.codigo}: {len(nomes)} — {", ".join(nomes)}'
                )

        self.stdout.write(self.style.SUCCESS('\nConcluido.'))
