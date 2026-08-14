"""
Foto de perfil enviada pela propria pessoa.

Convive com avatar_url, que guarda um endereco externo. Os dois existem porque
resolvem casos diferentes: a organizacao parceira envia o proprio logotipo, e
o campo de URL continua util para quem ja tem imagem hospedada em outro lugar.
A leitura prefere a foto enviada quando ha as duas.
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('autenticacao', '0008_usuario_assinatura_usuario_cargo_responsavel_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='usuario',
            name='foto',
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to='perfis/%Y/%m/',
                help_text='Foto de perfil, ou logotipo no caso da organizacao parceira',
            ),
        ),
    ]
