"""
Reindexa as publicacoes do forum na busca semantica.

Uso:
    python manage.py indexar_forum              # so o que falta ou mudou
    python manage.py indexar_forum --tudo       # refaz todos os vetores
    python manage.py indexar_forum --lote 64

Necessario em tres situacoes: ao ligar a busca semantica num banco que ja tem
conteudo, ao trocar o modelo de embeddings, e depois de uma importacao que
tenha gravado publicacoes sem passar pelos sinais.

O processamento e em lote porque o modelo vetoriza varios textos de uma vez com
custo muito menor do que um a um.
"""

import time

from django.core.management.base import BaseCommand, CommandError

from busca import embeddings
from busca.models import IndicePost
from busca.services import texto_do_post
from forum.models import Post


class Command(BaseCommand):
    help = 'Gera os embeddings das publicacoes do forum'

    def add_arguments(self, parser):
        parser.add_argument(
            '--tudo',
            action='store_true',
            help='Refaz o vetor de todas as publicacoes, inclusive as ja indexadas.',
        )
        parser.add_argument(
            '--lote',
            type=int,
            default=32,
            help='Quantas publicacoes por chamada ao modelo (padrao: 32).',
        )
        parser.add_argument(
            '--disciplina',
            help='Restringe a uma disciplina, pelo codigo.',
        )

    def handle(self, *args, **opcoes):
        if not embeddings.disponivel():
            raise CommandError(
                'sentence-transformers nao esta instalado neste ambiente.\n'
                '  pip install sentence-transformers pgvector'
            )

        publicacoes = Post.objects.filter(
            deleted_at__isnull=True
        ).select_related('post_pai').order_by('created_at')

        if opcoes['disciplina']:
            publicacoes = publicacoes.filter(disciplina__codigo=opcoes['disciplina'])

        if not opcoes['tudo']:
            # Ja indexado com o modelo atual fica de fora. O texto pode ter
            # mudado desde entao, e isso e verificado adiante, publicacao a
            # publicacao, porque comparar texto no banco sairia mais caro.
            ja_indexados = IndicePost.objects.filter(
                modelo=embeddings.MODELO
            ).values_list('post_id', flat=True)
        else:
            ja_indexados = []

        pendentes = list(publicacoes)
        total = len(pendentes)

        if total == 0:
            self.stdout.write('Nenhuma publicacao para indexar.')
            return

        self.stdout.write(f'Carregando o modelo {embeddings.MODELO}...')
        inicio = time.monotonic()

        indexados = 0
        pulados = 0
        lote = max(1, opcoes['lote'])

        indices_atuais = {
            indice.post_id: indice
            for indice in IndicePost.objects.filter(
                post_id__in=[post.id for post in pendentes]
            )
        }

        for comeco in range(0, total, lote):
            fatia = pendentes[comeco:comeco + lote]

            trabalho = []
            for post in fatia:
                texto = texto_do_post(post)

                if not texto:
                    pulados += 1
                    continue

                indice = indices_atuais.get(post.id)
                atualizado = (
                    indice is not None
                    and indice.modelo == embeddings.MODELO
                    and indice.texto == texto
                )

                if atualizado and not opcoes['tudo'] and post.id in ja_indexados:
                    pulados += 1
                    continue

                trabalho.append((post, texto))

            if not trabalho:
                continue

            vetores = embeddings.gerar_em_lote([texto for _, texto in trabalho])

            for (post, texto), vetor in zip(trabalho, vetores):
                IndicePost.objects.update_or_create(
                    post=post,
                    defaults={
                        'embedding': vetor,
                        'texto': texto,
                        'modelo': embeddings.MODELO,
                    },
                )
                indexados += 1

            self.stdout.write(
                f'  {min(comeco + lote, total)}/{total} publicacoes processadas'
            )

        decorrido = time.monotonic() - inicio

        self.stdout.write(self.style.SUCCESS(
            f'\n{indexados} publicacao(oes) indexada(s), {pulados} sem alteracao. '
            f'Tempo: {decorrido:.1f}s'
        ))
