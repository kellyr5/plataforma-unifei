"""
Conferencia da matriz curricular importada do PPC.

Uso:
    python manage.py shell < docs/diagnostico.py > docs/diagnostico.txt

O PPC de Ciencia da Computacao preve 31 disciplinas obrigatorias. O banco tem
uma a mais, e este script existe para descobrir qual: pode ser duplicata de
codigo, sobra de uma importacao anterior ou disciplina criada a mao durante os
testes. Nao remove nada; apenas descreve o que encontrou.
"""

from collections import Counter

from forum.models import Curso, Disciplina, PermissaoDisciplina, Post


print('=' * 72)
print('CURSOS')
print('=' * 72)

for curso in Curso.objects.all():
    total = Disciplina.objects.filter(curso=curso, deleted_at__isnull=True).count()
    obrigatorias = Disciplina.objects.filter(
        curso=curso, deleted_at__isnull=True, optativa=False,
    ).count()
    print(f'{curso.codigo:<8} {curso.nome:<34} '
          f'{total} disciplina(s), {obrigatorias} obrigatoria(s)')

print()
print('=' * 72)
print('OBRIGATORIAS POR PERIODO')
print('=' * 72)

obrigatorias = Disciplina.objects.filter(
    optativa=False, deleted_at__isnull=True,
).order_by('periodo_sugerido', 'codigo')

por_periodo = Counter(d.periodo_sugerido for d in obrigatorias)

for periodo in sorted(por_periodo):
    print(f'  {periodo}o periodo: {por_periodo[periodo]} disciplina(s)')

print(f'\n  Total: {obrigatorias.count()} (o PPC preve 31)')

print()
print('=' * 72)
print('CODIGOS REPETIDOS')
print('=' * 72)

codigos = Counter(
    Disciplina.objects.filter(deleted_at__isnull=True).values_list('codigo', flat=True)
)
repetidos = {codigo: n for codigo, n in codigos.items() if n > 1}

if repetidos:
    for codigo, n in repetidos.items():
        print(f'  {codigo}: {n} registros')
        for disciplina in Disciplina.objects.filter(codigo=codigo, deleted_at__isnull=True):
            print(f'      id={disciplina.id} periodo={disciplina.periodo_sugerido} '
                  f'nome="{disciplina.nome}" curso={disciplina.curso_id}')
else:
    print('  Nenhum codigo repetido.')

print()
print('=' * 72)
print('SEM CURSO OU SEM PERIODO')
print('=' * 72)

soltas = Disciplina.objects.filter(deleted_at__isnull=True).filter(
    curso__isnull=True,
) | Disciplina.objects.filter(deleted_at__isnull=True, periodo_sugerido__isnull=True)

for disciplina in soltas.distinct():
    print(f'  {disciplina.codigo:<10} periodo={disciplina.periodo_sugerido} '
          f'curso={disciplina.curso_id} nome="{disciplina.nome}" id={disciplina.id}')

if not soltas.exists():
    print('  Nenhuma.')

print()
print('=' * 72)
print('LISTA COMPLETA DAS OBRIGATORIAS')
print('=' * 72)
print('  Confira contra o PPC: a que sobrar e a que deve sair.\n')

for disciplina in obrigatorias:
    vinculos = PermissaoDisciplina.objects.filter(disciplina=disciplina).count()
    posts = Post.objects.filter(disciplina=disciplina, deleted_at__isnull=True).count()
    print(f'  {disciplina.periodo_sugerido}o  {disciplina.codigo:<10} '
          f'{disciplina.nome[:44]:<46} {vinculos} vinculo(s), {posts} post(s)')

print()
print('=' * 72)
print('COMO REMOVER, DEPOIS DE IDENTIFICAR')
print('=' * 72)
print("""
Soft delete preserva o historico e e o caminho seguro:

    from django.utils import timezone
    from forum.models import Disciplina

    d = Disciplina.objects.get(codigo='CODIGO_AQUI')
    d.deleted_at = timezone.now()
    d.save(update_fields=['deleted_at'])

Se a disciplina nao tiver vinculo nem post, apagar de vez tambem e seguro:

    Disciplina.objects.filter(codigo='CODIGO_AQUI').delete()
""")
