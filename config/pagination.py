"""
Paginação padrão da API.

Sem paginação, uma listagem de posts de disciplina movimentada devolveria
tudo de uma vez, o que pesa no banco, na rede e na renderização. Vinte itens
por página é suficiente para preencher a tela sem rolagem excessiva, e o
cliente pode pedir mais pelo parâmetro `page_size`, com teto de cem para que
ninguém contorne o limite pedindo dez mil registros.

O formato da resposta passa a ser:

    {"count": 42, "next": "...", "previous": null, "results": [...]}
"""

from rest_framework.pagination import PageNumberPagination


class PaginacaoPadrao(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100
