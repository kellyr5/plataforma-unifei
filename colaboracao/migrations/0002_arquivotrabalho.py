"""Material de apoio anexado ao enunciado do trabalho em grupo."""

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('colaboracao', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ArquivoTrabalho',
            fields=[
                ('id', models.UUIDField(
                    default=uuid.uuid4, editable=False, primary_key=True, serialize=False,
                )),
                ('arquivo', models.FileField(upload_to='trabalhos/%Y/%m/')),
                ('nome_original', models.CharField(max_length=255)),
                ('tamanho_bytes', models.BigIntegerField()),
                ('tipo_mime', models.CharField(blank=True, default='', max_length=100)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('trabalho', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='arquivos',
                    to='colaboracao.trabalho',
                )),
                ('enviado_por', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='arquivos_de_trabalho',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Arquivo de trabalho',
                'verbose_name_plural': 'Arquivos de trabalho',
                'db_table': 'arquivo_trabalho',
                'ordering': ['created_at'],
            },
        ),
    ]
