"""
Indexacao e consulta da busca do forum.

A busca tem dois caminhos e escolhe sozinha qual usar. O semantico compara o
significado da pergunta com o das publicacoes ja escritas e encontra a duvida
equivalente mesmo sem palavra em comum. O textual procura os termos digitados.
Quando o ambiente nao tem o modelo de embeddings instalado, ou quando o indice
ainda esta vazio, a busca textual responde e a tela continua util.

O recorte por disciplina nao e opcional em nenhum dos dois: a mesma regra que
impede alguem de ler o forum de uma turma que nao cursa vale aqui. Busca que
devolve trecho de conteudo restrito e um vazamento, mesmo que o link final
retorne 403.
"""

import logging

from django.db.models import Q

from busca import embeddings
from busca.models import IndicePost
from forum.models import PermissaoDisciplina, Post


logger = logging.getLogger(__name__)


def texto_do_post(post) -> str:
    """
    Monta o texto que representa a publicacao.

    Titulo e conteudo entram juntos porque o titulo costuma carregar o assunto
    e o conteudo, o detalhe. Numa resposta, que nao tem titulo, o titulo do
    topico entra no lugar: sem ele, "sim, e isso mesmo" viraria um vetor sem
    relacao alguma com o assunto tratado.
    """
    partes = []

    if post.titulo:
        partes.append(post.titulo)
    elif post.post_pai_id and post.post_pai.titulo:
        partes.append(post.post_pai.titulo)

    partes.append(post.conteudo or '')

    return '\n'.join(parte for parte in partes if parte).strip()


def indexar_post(post, forcar=False):
    """
    Cria ou atualiza o vetor de uma publicacao.

    Devolve None quando nao ha o que fazer: sem biblioteca, sem texto, ou texto
    inalterado desde a ultima indexacao. Nao levanta excecao por ausencia do
    modelo, porque quem chama e o salvamento de um post, e uma publicacao nao
    pode falhar porque a busca semantica nao esta configurada.
    """
    if not embeddings.disponivel():
        return None

    texto = texto_do_post(post)

    if not texto:
        return None

    indice = IndicePost.objects.filter(post=post).first()

    # Texto igual e mesmo modelo: o vetor guardado continua valendo.
    if (
        indice is not None
        and not forcar
        and indice.texto == texto
        and indice.modelo == embeddings.MODELO
    ):
        return indice

    try:
        vetor = embeddings.gerar(texto)
    except Exception as erro:  # noqa: BLE001
        logger.warning('Falha ao indexar post %s: %s', post.id, erro)
        return None

    indice, _ = IndicePost.objects.update_or_create(
        post=post,
        defaults={
            'embedding': vetor,
            'texto': texto,
            'modelo': embeddings.MODELO,
        },
    )

    return indice


def disciplinas_visiveis(usuario):
    """Disciplinas cujo conteudo a pessoa pode ler."""
    return PermissaoDisciplina.objects.filter(
        usuario=usuario, ativo=True,
    ).values_list('disciplina_id', flat=True)


def _publicacoes_permitidas(usuario, disciplina=None):
    """Base comum aos dois modos de busca, ja com o recorte de acesso."""
    queryset = Post.objects.filter(
        deleted_at__isnull=True,
        disciplina_id__in=disciplinas_visiveis(usuario),
    ).select_related('disciplina', 'autor', 'post_pai')

    if disciplina:
        queryset = queryset.filter(disciplina_id=disciplina)

    # Publicacao restrita pela disciplina so aparece para quem a escreveu e
    # para quem modera. A busca respeita a mesma regra do forum.
    return queryset.filter(Q(restrito=False) | Q(autor=usuario))


def buscar_textual(usuario, consulta, disciplina=None, limite=20):
    """Correspondencia por termo, no titulo e no conteudo."""
    return list(
        _publicacoes_permitidas(usuario, disciplina).filter(
            Q(titulo__icontains=consulta) | Q(conteudo__icontains=consulta)
        ).order_by('-created_at')[:limite]
    )


def buscar_semantica(usuario, consulta, disciplina=None, limite=20, distancia_maxima=0.75):
    """
    Publicacoes proximas ao significado da consulta.

    O corte por distancia existe para a busca poder devolver nada. Sem ele, uma
    pergunta sobre qualquer assunto sempre traria as vinte publicacoes menos
    distantes do banco, e resultado irrelevante apresentado como resposta e pior
    do que lista vazia.
    """
    if not embeddings.disponivel():
        return None

    try:
        from pgvector.django import CosineDistance
    except ImportError:
        logger.warning('pgvector nao instalado; a busca semantica fica indisponivel.')
        return None

    try:
        vetor = embeddings.gerar(consulta)
    except Exception as erro:  # noqa: BLE001
        logger.warning('Falha ao vetorizar a consulta: %s', erro)
        return None

    permitidos = _publicacoes_permitidas(usuario, disciplina).values_list('id', flat=True)

    indices = IndicePost.objects.filter(
        post_id__in=permitidos,
        modelo=embeddings.MODELO,
    ).annotate(
        distancia=CosineDistance('embedding', vetor)
    ).filter(
        distancia__lte=distancia_maxima
    ).select_related(
        'post', 'post__disciplina', 'post__autor', 'post__post_pai',
    ).order_by('distancia')[:limite]

    return [(indice.post, float(indice.distancia)) for indice in indices]


def buscar(usuario, consulta, disciplina=None, limite=20):
    """
    Ponto unico de entrada, com o modo escolhido conforme o ambiente.

    Devolve (resultados, modo), em que resultados e uma lista de
    (post, relevancia) e modo indica qual caminho respondeu. A tela mostra o
    modo porque a diferenca importa a quem procura: em busca textual, nao
    encontrar significa que os termos nao aparecem; em busca semantica,
    significa que ninguem perguntou algo parecido.
    """
    consulta = (consulta or '').strip()

    if not consulta:
        return [], 'vazia'

    semantica = buscar_semantica(usuario, consulta, disciplina, limite)

    if semantica:
        return semantica, 'semantica'

    # Sem modelo, sem indice ou sem nada suficientemente proximo: os termos
    # digitados ainda podem aparecer literalmente em alguma publicacao.
    textual = buscar_textual(usuario, consulta, disciplina, limite)

    return [(post, None) for post in textual], 'textual'
