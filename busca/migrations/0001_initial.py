"""
Indice semantico do forum.

A extensao vector precisa existir antes da tabela, porque o tipo da coluna vem
dela. E uma extensao binaria do PostgreSQL, instalada pelo sistema operacional
e nao pelo pip: ter o pacote Python pgvector nao basta.

A criacao passa por uma operacao propria em vez do CreateExtension padrao do
Django. O motivo e a mensagem: sem a extensao no servidor, o Django devolve
sessenta linhas de traceback terminando em "could not open extension control
file", que nao diz a ninguem o que fazer. A operacao abaixo interrompe a
migracao com a instrucao exata.
"""

import uuid

import django.db.models.deletion
from django.db import migrations, models
from pgvector.django import VectorField

from busca.embeddings import DIMENSOES


class CriarExtensaoVetor(migrations.RunSQL):
    """
    Cria a extensao vector, explicando o que falta quando nao da.

    Idempotente: rodar de novo num banco que ja tem a extensao nao faz nada.
    """

    def __init__(self):
        super().__init__(
            sql='CREATE EXTENSION IF NOT EXISTS vector;',
            reverse_sql='DROP EXTENSION IF EXISTS vector;',
        )

    def database_forwards(self, app_label, schema_editor, from_state, to_state):
        from django.db.utils import Error

        try:
            super().database_forwards(app_label, schema_editor, from_state, to_state)
        except Error as erro:
            if 'permission denied' in str(erro).lower():
                instrucao = (
                    'A extensao pgvector esta instalada, mas o usuario da\n'
                    'aplicacao nao tem permissao para cria-la neste banco.\n'
                    '\n'
                    'Acontece sobretudo no banco de teste, que o Django recria\n'
                    'do zero a cada execucao da suite. A saida e criar a\n'
                    'extensao no template1, o molde de todo banco novo:\n'
                    '\n'
                    '    sudo -u postgres psql -d template1 \\\n'
                    '        -c "CREATE EXTENSION IF NOT EXISTS vector;"\n'
                    '\n'
                    'Assim cada banco criado depois ja nasce com ela, e o\n'
                    'CREATE EXTENSION IF NOT EXISTS passa a nao fazer nada —\n'
                    'sem exigir privilegio de superusuario.\n'
                )
            else:
                instrucao = (
                    'A extensao pgvector nao esta instalada no PostgreSQL.\n'
                    '\n'
                    'Ela e um binario do servidor, instalado pelo sistema, e\n'
                    'nao pelo pip. No Ubuntu/WSL, conforme a versao instalada:\n'
                    '\n'
                    '    sudo apt update\n'
                    '    sudo apt install postgresql-14-pgvector\n'
                    '    sudo service postgresql restart\n'
                )

            raise RuntimeError(
                '\n' + instrucao + '\n'
                'Se preferir manter a plataforma sem busca semantica, remova\n'
                "'busca' de INSTALLED_APPS e a rota /api/busca/ de\n"
                'config/urls.py. Nenhuma outra tela depende deste app.\n'
                '\n'
                f'Erro original do banco: {erro}'
            ) from erro


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('forum', '0001_initial'),
    ]

    operations = [
        CriarExtensaoVetor(),
        migrations.CreateModel(
            name='IndicePost',
            fields=[
                ('id', models.UUIDField(
                    default=uuid.uuid4, editable=False, primary_key=True, serialize=False,
                )),
                ('embedding', VectorField(dimensions=DIMENSOES)),
                ('texto', models.TextField()),
                ('modelo', models.CharField(max_length=120)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('post', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='indice_semantico',
                    to='forum.post',
                )),
            ],
            options={
                'verbose_name': 'indice semantico',
                'verbose_name_plural': 'indices semanticos',
                'ordering': ['-updated_at'],
            },
        ),
    ]
