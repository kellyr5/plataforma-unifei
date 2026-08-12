"""
Importa a matriz curricular a partir do texto extraido do PPC.

Uso:
    pdftotext -layout docs/PPC_cco.pdf docs/ppc-cco.txt
    python manage.py importar_matriz_ppc docs/ppc-cco.txt \\
        --curso CCO --nome "Ciencia da Computacao" \\
        --semestre 2026.1 --versao-ppc "Jan/2025"

O PPC apresenta a matriz em tabelas de largura fixa, uma por periodo:

      1º PERÍODO                                        CARGA HORÁRIA
      CÓDIGO      DISCIPLINA        PRÉ-REQUISITOS   Teórica Prática EAD Total
       XDES01  Fundamentos de Programação      -        32      32     0   64
      ...
                                                                 Total 288

O parser se apoia no formato estavel dessas linhas: codigo na primeira
coluna, quatro numeros no fim e o que sobra no meio dividido entre nome e
pre-requisitos. Linhas de cabecalho, de rodape e de total sao descartadas.

A importacao e idempotente: rodar de novo atualiza as disciplinas ja
cadastradas em vez de duplicar, o que permite reimportar quando o PPC mudar.
Os pre-requisitos sao resolvidos numa segunda passada, porque uma disciplina
pode exigir outra que ainda nao foi criada quando ela e lida.
"""

import re
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from forum.models import Curso, Disciplina


# Cabecalho de periodo: "  3º PERÍODO   CARGA HORÁRIA"
PADRAO_PERIODO = re.compile(r'^\s*(\d{1,2})\s*º\s*PER[ÍI]ODO', re.IGNORECASE)

# Codigo de disciplina: letras seguidas de digito, com ate dois caracteres
# depois. Cobre XDES01, MAT00A, CRSC03 e tambem TCC1 e TCC2.
CODIGO = r'[A-Z]{2,6}[0-9][0-9A-Z]{0,2}'

# Linha de disciplina: codigo, nome, pre-requisitos e quatro colunas de carga
# horaria. Nas optativas e nos TCCs as tres primeiras colunas vem com
# travessao, porque a distribuicao depende da disciplina escolhida; apenas o
# total e sempre numerico.
PADRAO_LINHA = re.compile(
    rf'^\s*(?P<codigo>{CODIGO}|-)\s+'
    r'(?P<resto>.+?)\s+'
    r'(?P<teorica>[\d-]{1,3})\s+(?P<pratica>[\d-]{1,3})\s+'
    r'(?P<ead>[\d-]{1,3})\s+(?P<total>\d{1,3})\s*$'
)

# Codigos citados na coluna de pre-requisitos, separados por virgula.
PADRAO_CODIGO = re.compile(rf'\b{CODIGO}\b')

# Marcadores de nota de rodape que acompanham alguns nomes no PPC.
PADRAO_RODAPE = re.compile(r'[*†∗]+\s*$')

# Linhas que nao descrevem disciplina.
DESCARTAR = ('CÓDIGO', 'CODIGO', 'Total', 'CARGA HORÁRIA', 'PERÍODO')


class Command(BaseCommand):
    help = 'Importa a matriz curricular de um curso a partir do texto do PPC'

    def add_arguments(self, parser):
        parser.add_argument('arquivo', help='Caminho do texto extraido do PPC')
        parser.add_argument('--curso', required=True, help='Codigo do curso, ex: CCO')
        parser.add_argument('--nome', required=True, help='Nome do curso')
        parser.add_argument('--semestre', default='2026.1', help='Semestre de oferta inicial')
        parser.add_argument('--versao-ppc', default='', help='Versao do PPC, ex: Jan/2025')
        parser.add_argument(
            '--simular',
            action='store_true',
            help='Mostra o que seria importado sem gravar nada',
        )

    def handle(self, *args, **opcoes):
        caminho = Path(opcoes['arquivo'])

        if not caminho.exists():
            raise CommandError(f'Arquivo nao encontrado: {caminho}')

        linhas = caminho.read_text(encoding='utf-8', errors='ignore').splitlines()
        registros = self._extrair(linhas)

        if not registros:
            raise CommandError(
                'Nenhuma disciplina reconhecida. Confirme que o texto foi gerado '
                'com "pdftotext -layout", que preserva o alinhamento das colunas.'
            )

        self._separar_co_requisitos(registros)

        self.stdout.write(f'{len(registros)} disciplina(s) reconhecida(s) na matriz.')

        if opcoes['simular']:
            self._mostrar(registros)
            self.stdout.write(self.style.WARNING('Simulacao: nada foi gravado.'))
            return

        criadas, atualizadas, vinculos = self._gravar(registros, opcoes)

        self.stdout.write(self.style.SUCCESS(
            f'Importacao concluida. {criadas} criada(s), {atualizadas} atualizada(s), '
            f'{vinculos} pre-requisito(s) vinculado(s).'
        ))

    # ===== Leitura =====

    def _extrair(self, linhas):
        """Percorre o texto acumulando as disciplinas de cada periodo."""
        registros = []
        periodo_atual = None

        for linha in linhas:
            cabecalho = PADRAO_PERIODO.search(linha)
            if cabecalho:
                periodo_atual = int(cabecalho.group(1))
                continue

            if periodo_atual is None:
                continue

            if any(marca in linha for marca in DESCARTAR):
                continue

            achado = PADRAO_LINHA.match(linha)
            if not achado:
                continue

            registro = self._montar_registro(achado, periodo_atual)
            if registro:
                registros.append(registro)

        return registros

    def _montar_registro(self, achado, periodo):
        codigo = achado.group('codigo')
        resto = achado.group('resto').strip()

        # O nome e a coluna de pre-requisitos ficam separados por espacos
        # multiplos, resultado do alinhamento em colunas do documento.
        partes = re.split(r'\s{2,}', resto)
        nome = PADRAO_RODAPE.sub('', partes[0].strip()).strip()
        coluna_pre = ' '.join(partes[1:]) if len(partes) > 1 else ''

        # A optativa nao tem codigo proprio na matriz: ela e uma vaga que o
        # aluno preenche com uma disciplina da lista de optativas. Guardamos
        # como marcador do periodo, com codigo derivado da numeracao do PPC
        # para que reimportar nao duplique.
        if codigo == '-':
            numero = re.search(r'Optativa\s+(\d+)', nome)
            codigo = f'OPT{int(numero.group(1)):02d}' if numero else f'OPTAHC{periodo}'

            return {
                'codigo': codigo,
                'nome': nome,
                'periodo': periodo,
                'carga_horaria': int(achado.group('total')),
                'optativa': True,
                'pre_requisitos': [],
                'co_requisitos': [],
            }

        return {
            'codigo': codigo,
            'nome': nome,
            'periodo': periodo,
            'carga_horaria': int(achado.group('total')),
            'optativa': False,
            'pre_requisitos': PADRAO_CODIGO.findall(coluna_pre),
            'co_requisitos': [],
        }

    def _separar_co_requisitos(self, registros):
        """
        Move as referencias mutuas de pre-requisito para co-requisito.

        O PPC marca com adaga as disciplinas que sao cursadas em conjunto, como
        TCC1 e Metodologia Cientifica, e as lista uma na coluna de requisitos da
        outra. Lidas literalmente, formam um ciclo impossivel de cumprir. Como
        a reciprocidade e o proprio indicio do co-requisito, detectamos o par
        pela referencia mutua, sem depender do simbolo, que o extrator de texto
        nem sempre preserva.
        """
        por_codigo = {r['codigo']: r for r in registros}

        for registro in registros:
            for codigo in list(registro['pre_requisitos']):
                outro = por_codigo.get(codigo)

                if outro and registro['codigo'] in outro['pre_requisitos']:
                    registro['pre_requisitos'].remove(codigo)
                    registro['co_requisitos'].append(codigo)

    def _mostrar(self, registros):
        for registro in registros:
            pre = ', '.join(registro['pre_requisitos']) or '-'
            co = ', '.join(registro['co_requisitos'])
            sufixo = f'  co: {co}' if co else ''
            self.stdout.write(
                f"  {registro['periodo']}º  {registro['codigo']:<8} "
                f"{registro['nome'][:45]:<45} {registro['carga_horaria']:>3}h  "
                f"pre: {pre}{sufixo}"
            )

    # ===== Gravacao =====

    @transaction.atomic
    def _gravar(self, registros, opcoes):
        curso, _ = Curso.objects.update_or_create(
            codigo=opcoes['curso'].upper(),
            defaults={
                'nome': opcoes['nome'],
                'versao_ppc': opcoes['versao_ppc'],
                'periodos': max(r['periodo'] for r in registros),
            },
        )

        criadas = atualizadas = 0

        for registro in registros:
            _, foi_criada = Disciplina.objects.update_or_create(
                codigo=registro['codigo'],
                defaults={
                    'nome': registro['nome'],
                    'curso': curso,
                    'periodo_sugerido': registro['periodo'],
                    'carga_horaria': registro['carga_horaria'],
                    'optativa': registro['optativa'],
                    'semestre': opcoes['semestre'],
                },
            )
            criadas += int(foi_criada)
            atualizadas += int(not foi_criada)

        # Segunda passada: agora todas existem e os vinculos podem ser feitos.
        # Uma disciplina do terceiro periodo referencia outra do primeiro, que
        # talvez ainda nao existisse quando ela foi lida.
        vinculos = 0
        for registro in registros:
            if not (registro['pre_requisitos'] or registro['co_requisitos']):
                continue

            disciplina = Disciplina.objects.get(codigo=registro['codigo'])

            requisitos = Disciplina.objects.filter(codigo__in=registro['pre_requisitos'])
            disciplina.pre_requisitos.set(requisitos)
            vinculos += requisitos.count()

            co_requisitos = Disciplina.objects.filter(codigo__in=registro['co_requisitos'])
            disciplina.co_requisitos.set(co_requisitos)
            vinculos += co_requisitos.count()

        return criadas, atualizadas, vinculos
