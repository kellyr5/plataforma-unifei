"""
Indice semantico das publicacoes do forum.

O forum acumula perguntas que se repetem com palavras diferentes. "Por que meu
laco executa uma vez a mais" e "erro de off-by-one em vetor" sao a mesma
duvida e nao compartilham nenhum termo, entao a busca por palavra-chave nunca
liga uma a outra. O indice guarda o significado do texto como vetor, e a
proximidade entre vetores aproxima as duas perguntas.

O indice fica em tabela propria, e nao em coluna do Post, por tres motivos:
o vetor e grande e seria carregado em toda consulta ao forum; o modelo de
embedding pode mudar, e trocar de modelo vira uma reindexacao isolada em vez
de uma migracao do forum inteiro; e a plataforma continua funcionando com a
tabela vazia, o que mantem a busca semantica como recurso adicional e nao como
dependencia do fórum.
"""

import uuid

from django.db import models

from pgvector.django import VectorField

from busca.embeddings import DIMENSOES


class IndicePost(models.Model):
    """
    Representacao vetorial de uma publicacao.

    Guardamos tambem o texto que gerou o vetor. Sem isso nao ha como saber se
    o indice esta desatualizado depois que alguem edita a publicacao, e a
    alternativa seria reindexar tudo por precaucao a cada execucao.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    post = models.OneToOneField(
        'forum.Post',
        on_delete=models.CASCADE,
        related_name='indice_semantico',
    )

    # O vetor propriamente dito. A dimensao acompanha o modelo declarado em
    # embeddings.py: trocar de modelo exige migracao e reindexacao.
    embedding = VectorField(dimensions=DIMENSOES)

    # Recorte do texto indexado, para conferencia e para detectar edicao.
    texto = models.TextField()

    # Nome do modelo que gerou o vetor. Convivem no banco vetores de modelos
    # diferentes durante uma reindexacao, e comparar vetores de modelos
    # distintos produz resultado sem sentido.
    modelo = models.CharField(max_length=120)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'indice semantico'
        verbose_name_plural = 'indices semanticos'
        ordering = ['-updated_at']

    def __str__(self):
        return f'Indice de {self.post_id}'
