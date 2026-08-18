"""
Cadastra participantes da avaliacao a partir de uma planilha.

Uso:
    python manage.py cadastrar_participantes docs/participantes.csv
    python manage.py cadastrar_participantes docs/participantes.csv --pendente
    python manage.py cadastrar_participantes docs/participantes.csv --conferir

Formato do arquivo, separado por ponto e virgula, com cabecalho:

    cpf;email;nome;perfil;disciplinas
    12345678901;ana.souza@unifei.edu.br;Ana Souza;aluno;CTCO01,CMAC04
    98765432100;rafael.lima@unifei.edu.br;Rafael Lima;professor;CTCO01
    11122233344;coord@unifei.edu.br;Marina Alves;coordenacao;
    55566677788;contato@ong.org.br;Instituto Semear;organizacao;

Perfis aceitos:

    aluno         matriculado nas disciplinas informadas
    monitor       monitor nas disciplinas informadas; continua sendo estudante
    professor     leciona as disciplinas informadas
    coordenacao   responde pelo curso; nao se vincula a disciplina
    organizacao   publica oportunidades de voluntariado; nao entra no forum

A coluna de disciplinas aceita varios codigos separados por virgula, e fica
vazia para coordenacao e organizacao, que nao tem vinculo com turma.

Sobre a senha
-------------
O comando nao define senha. As contas nascem inativas e sem senha utilizavel,
e cada pessoa cria a sua no primeiro acesso, confirmando o CPF e o e-mail
institucional que voce cadastrou aqui. E o mesmo fluxo do uso real, o que faz
a avaliacao medir o sistema como ele e, e nao uma versao facilitada dele.

O comando e idempotente: rodar de novo atualiza quem ja existe em vez de
duplicar, o que permite corrigir a planilha e reexecutar. Rodar de novo sobre
alguem que ja ativou a conta nao apaga a senha dessa pessoa.
"""

import csv
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from autenticacao.models import RoleGlobal, Usuario
from forum.models import Disciplina, PermissaoDisciplina


PERFIS = ('aluno', 'monitor', 'professor', 'coordenacao', 'organizacao')

# Perfis que se traduzem em vinculo com disciplina, e qual papel recebem.
PAPEL_POR_PERFIL = {
    'aluno': 'aluno',
    'monitor': 'monitor',
    'professor': 'professor',
}


class Command(BaseCommand):
    help = 'Cadastra participantes da avaliacao a partir de um arquivo CSV'

    def add_arguments(self, parser):
        parser.add_argument('arquivo', help='Caminho do CSV com os participantes.')
        parser.add_argument(
            '--conferir',
            action='store_true',
            help='Apenas valida o arquivo e mostra o que seria feito, sem gravar.',
        )

    def handle(self, *args, **opcoes):
        caminho = Path(opcoes['arquivo'])

        if not caminho.exists():
            raise CommandError(f'Arquivo nao encontrado: {caminho}')

        linhas = self._ler(caminho)
        self._validar(linhas)

        if opcoes['conferir']:
            self.stdout.write(self.style.WARNING(
                '\nModo conferencia: nada foi gravado.\n'
            ))
            self._resumir(linhas)
            return

        with transaction.atomic():
            for linha in linhas:
                self._cadastrar(linha)

        self._resumir(linhas)

    # ===== Leitura e validacao =====

    def _ler(self, caminho):
        with caminho.open(encoding='utf-8-sig', newline='') as arquivo:
            leitor = csv.DictReader(arquivo, delimiter=';')

            esperadas = {'cpf', 'email', 'nome', 'perfil', 'disciplinas'}
            encontradas = set(leitor.fieldnames or [])

            if not esperadas.issubset(encontradas):
                faltando = ', '.join(sorted(esperadas - encontradas))
                raise CommandError(
                    f'O cabecalho do arquivo esta incompleto. Faltam: {faltando}\n'
                    'A primeira linha deve ser exatamente:\n'
                    '  cpf;email;nome;perfil;disciplinas'
                )

            return [
                {chave: (valor or '').strip() for chave, valor in linha.items()}
                for linha in leitor
                if any((valor or '').strip() for valor in linha.values())
            ]

    def _validar(self, linhas):
        """
        Confere o arquivo inteiro antes de gravar qualquer coisa.

        Validar tudo de uma vez, e nao linha a linha durante a gravacao, evita
        o pior caso: metade das pessoas cadastradas e a outra metade nao,
        exigindo descobrir onde parou.
        """
        if not linhas:
            raise CommandError('O arquivo nao tem nenhuma linha de dados.')

        codigos = set(
            Disciplina.objects.filter(deleted_at__isnull=True)
            .values_list('codigo', flat=True)
        )

        erros = []
        cpfs_vistos = set()

        for numero, linha in enumerate(linhas, start=2):
            cpf = ''.join(filtro for filtro in linha['cpf'] if filtro.isdigit())

            if len(cpf) != 11:
                erros.append(f'linha {numero}: CPF invalido ({linha["cpf"]!r})')
            elif cpf in cpfs_vistos:
                erros.append(f'linha {numero}: CPF repetido no arquivo ({cpf})')
            else:
                cpfs_vistos.add(cpf)

            linha['cpf'] = cpf

            if '@' not in linha['email']:
                erros.append(f'linha {numero}: e-mail invalido ({linha["email"]!r})')

            if not linha['nome']:
                erros.append(f'linha {numero}: nome em branco')

            perfil = linha['perfil'].lower()
            linha['perfil'] = perfil

            if perfil not in PERFIS:
                erros.append(
                    f'linha {numero}: perfil {perfil!r} desconhecido. '
                    f'Use um destes: {", ".join(PERFIS)}'
                )

            disciplinas = [
                codigo.strip().upper()
                for codigo in linha['disciplinas'].split(',')
                if codigo.strip()
            ]
            linha['disciplinas'] = disciplinas

            if perfil in PAPEL_POR_PERFIL and not disciplinas:
                erros.append(
                    f'linha {numero}: perfil {perfil!r} precisa de ao menos '
                    'uma disciplina'
                )

            for codigo in disciplinas:
                if codigo not in codigos:
                    erros.append(
                        f'linha {numero}: disciplina {codigo!r} nao existe no banco'
                    )

        if erros:
            raise CommandError(
                'O arquivo tem problemas e nada foi gravado:\n  '
                + '\n  '.join(erros)
            )

    # ===== Gravacao =====

    def _cadastrar(self, linha):
        usuario = Usuario.objects.filter(cpf=linha['cpf']).first()

        if usuario is None:
            usuario = Usuario(
                cpf=linha['cpf'],
                email=linha['email'].lower(),
                nome_completo=linha['nome'],
                ativo=False,
            )
            # Sem senha utilizavel: a pessoa cria a dela no primeiro acesso.
            usuario.set_unusable_password()
        else:
            # Quem ja existe mantem a senha e a ativacao. Reexecutar o comando
            # para corrigir um nome ou uma disciplina nao pode derrubar o
            # acesso de quem ja entrou.
            usuario.email = linha['email'].lower()
            usuario.nome_completo = linha['nome']

        # A coordenacao administra o curso inteiro.
        usuario.is_admin = linha['perfil'] == 'coordenacao'

        usuario.save()

        if linha['perfil'] == 'organizacao':
            RoleGlobal.objects.get_or_create(usuario=usuario, role='ong')

        papel = PAPEL_POR_PERFIL.get(linha['perfil'])

        if not papel:
            return

        for codigo in linha['disciplinas']:
            disciplina = Disciplina.objects.get(
                codigo=codigo, deleted_at__isnull=True,
            )
            PermissaoDisciplina.objects.update_or_create(
                usuario=usuario,
                disciplina=disciplina,
                defaults={'papel': papel, 'ativo': True},
            )

    # ===== Saida =====

    def _resumir(self, linhas):
        self.stdout.write('')
        self.stdout.write(f'{"CPF":<14}{"PERFIL":<14}{"NOME":<26}DISCIPLINAS')
        self.stdout.write('-' * 78)

        for linha in linhas:
            self.stdout.write(
                f'{linha["cpf"]:<14}{linha["perfil"]:<14}'
                f'{linha["nome"][:24]:<26}'
                f'{", ".join(linha["disciplinas"]) or "—"}'
            )

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(
            f'{len(linhas)} participante(s) processado(s).'
        ))

        self.stdout.write(
            'Cada pessoa entra pelo "Primeiro Acesso", informando o CPF e o\n'
            'e-mail cadastrados acima, e cria a propria senha nesse momento.'
        )
