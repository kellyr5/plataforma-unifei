"""
Confere o periodo de oferta contra as duas fontes do PPC. Nao altera nada.

Uso:
    python manage.py shell < docs/corrigir_periodos.py

Achado
------
Nao ha disciplina sobrando. As 32 obrigatorias estao corretas: a Tabela 4.2
lista 30, e TCC1 e TCC2 sao obrigatorias descritas fora dela. O numero 31 que
usavamos como referencia estava errado.

O que existe e uma divergencia interna do proprio PPC. Ele declara o periodo
de cada disciplina em dois lugares, e os dois discordam em quatro casos:

    codigo    Tabela 4.2    Ementario (secao 5)
    XPAD01        4               5
    CTCO03        4               5
    CTCO05        6               5
    CTCO06        7               6

A plataforma segue o ementario, que e a fonte usada pelo importador. A escolha
tem razao: o ementario organiza as disciplinas em grades por periodo, com a
carga horaria somada ao fim de cada uma, e e o desenho da oferta semestral que
a coordenacao efetivamente monta. A Tabela 4.2 e um indice por area de
conhecimento, onde a coluna de periodo e informacao secundaria.

Este script existe para que a divergencia fique registrada e verificavel, e
nao para corrigi-la: mudar o periodo aqui desalinharia a plataforma da grade
real do curso. A correcao, se couber, e no documento.
"""

from forum.models import Disciplina


# Periodo declarado na Tabela 4.2, que e o indice por area de conhecimento.
TABELA_4_2 = {
    'XDES01': 1, 'XDES02': 3, 'XDES03': 4, 'XDES04': 3, 'CDES05': 4,
    'XPAD01': 4, 'XMCO01': 5, 'CMCO05': 5,
    'XRSC01': 4, 'CRSC02': 3, 'CRSC03': 1, 'CRSC04': 2, 'CRSC05': 4,
    'CTCO01': 2, 'CTCO02': 3, 'CTCO03': 4, 'CTCO04': 4, 'CTCO05': 6,
    'CTCO06': 7,
    'MAT00A': 1, 'MAT00B': 2, 'XMAC01': 1, 'XMAC02': 3,
    'CMAC03': 3, 'CMAC04': 2, 'CMAC05': 4,
    'XAHC01': 7, 'XAHC02': 6, 'XAHC03': 7, 'CAHC04': 1,
}


print('=' * 70)
print('DIVERGENCIAS ENTRE A TABELA 4.2 E O EMENTARIO')
print('=' * 70)

divergentes = 0

for codigo, periodo_tabela in sorted(TABELA_4_2.items()):
    disciplina = Disciplina.objects.filter(
        codigo=codigo, deleted_at__isnull=True,
    ).first()

    if disciplina is None:
        print(f'  {codigo:<8} nao encontrada no banco')
        continue

    if disciplina.periodo_sugerido == periodo_tabela:
        continue

    divergentes += 1
    print(
        f'  {codigo:<8} {disciplina.nome[:38]:<40} '
        f'Tabela 4.2: {periodo_tabela}o | plataforma: {disciplina.periodo_sugerido}o'
    )

print(f'\n  {divergentes} divergencia(s). Nada foi alterado.')

print()
print('=' * 70)
print('OFERTA POR SEMESTRE, PELA PARIDADE DO PERIODO')
print('=' * 70)
print('  Periodo impar e ofertado no primeiro semestre; par, no segundo.\n')

for resto, rotulo in ((1, 'Primeiro semestre'), (0, 'Segundo semestre')):
    codigos = sorted(
        d.codigo for d in Disciplina.objects.filter(
            optativa=False, deleted_at__isnull=True,
        )
        if d.periodo_sugerido and d.periodo_sugerido % 2 == resto
    )
    print(f'  {rotulo}: {len(codigos)} disciplina(s)')
    print(f'    {", ".join(codigos)}\n')
