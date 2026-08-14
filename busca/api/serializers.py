"""Serializers da busca."""

from rest_framework import serializers


class ResultadoBuscaSerializer(serializers.Serializer):
    """
    Um resultado da busca.

    Nao e um ModelSerializer porque o objeto entregue e um par (post,
    relevancia): a relevancia nasce da consulta e nao existe no modelo.
    """

    id = serializers.UUIDField(read_only=True)
    titulo = serializers.CharField(read_only=True)
    trecho = serializers.CharField(read_only=True)
    autor_nome = serializers.CharField(read_only=True)
    disciplina_codigo = serializers.CharField(read_only=True)
    topico_id = serializers.UUIDField(read_only=True)
    e_resposta = serializers.BooleanField(read_only=True)
    relevancia = serializers.FloatField(read_only=True, allow_null=True)
    created_at = serializers.DateTimeField(read_only=True)


def montar_resultado(post, distancia):
    """
    Traduz o par (post, distancia) no formato que a tela consome.

    A distancia do cosseno vai de 0 (identico) a 2 (oposto). Convertemos em
    relevancia de 0 a 1 porque "87% de proximidade" e legivel e "distancia
    0,26" nao e. Quando a busca foi textual nao ha distancia, e o campo vem
    nulo em vez de zero: zero significaria correspondencia perfeita.
    """
    titulo = post.titulo or (
        f'Resposta em: {post.post_pai.titulo}' if post.post_pai_id else '(sem titulo)'
    )

    conteudo = (post.conteudo or '').strip()

    # Identificadores saem como texto, e nao como objeto UUID. E o formato que
    # chega ao navegador depois da serializacao, e devolver o objeto faria a
    # resposta em memoria divergir da resposta na rede — divergencia que so
    # aparece em teste, e sempre como surpresa.
    return {
        'id': str(post.id),
        'titulo': titulo,
        'trecho': conteudo[:240] + ('...' if len(conteudo) > 240 else ''),
        'autor_nome': post.autor.nome_completo,
        'disciplina_codigo': post.disciplina.codigo,
        'topico_id': str(post.post_pai_id or post.id),
        'e_resposta': post.post_pai_id is not None,
        'relevancia': None if distancia is None else max(0.0, 1.0 - distancia),
        'created_at': post.created_at,
    }
