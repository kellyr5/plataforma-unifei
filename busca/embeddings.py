"""
Geracao de embeddings, executada localmente.

Fase 1 do plano de IA: nada sai da infraestrutura da universidade. O texto das
publicacoes e material academico de estudantes identificaveis, e enviar isso a
um servico externo criaria uma questao de tratamento de dados que o projeto nao
precisa ter para entregar busca por significado.

O modelo escolhido e multilingue e pequeno o bastante para rodar em CPU. Um
modelo maior daria alguns pontos de qualidade a mais e exigiria GPU para
responder em tempo aceitavel, o que nao se sustenta num laboratorio de
graduacao.

O carregamento e preguicoso e acontece uma vez por processo. Carregar na
importacao faria o `manage.py` gastar dezenas de segundos em qualquer comando,
inclusive `migrate` e os testes.
"""

import logging
import threading


logger = logging.getLogger(__name__)


# Modelo e dimensao andam juntos: mudar um sem o outro invalida o indice.
MODELO = 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'
DIMENSOES = 384

# Texto acima disto e truncado. O modelo ignora o excedente de qualquer forma,
# e truncar antes evita transferir a publicacao inteira para o tokenizador.
LIMITE_CARACTERES = 2000


_modelo = None
_trava = threading.Lock()


class EmbeddingIndisponivel(RuntimeError):
    """A biblioteca de embeddings nao esta instalada neste ambiente."""


def disponivel() -> bool:
    """
    Informa se o ambiente consegue gerar embeddings.

    A plataforma roda sem eles: a busca cai para correspondencia textual e
    nenhuma outra tela e afetada. Deixar isso explicito evita que a ausencia da
    biblioteca vire erro de servidor numa tela que o usuario abriu para
    procurar uma duvida.
    """
    try:
        import sentence_transformers  # noqa: F401
    except ImportError:
        return False

    return True


def _carregar():
    """Carrega o modelo uma unica vez, com trava para requisicoes simultaneas."""
    global _modelo

    if _modelo is not None:
        return _modelo

    with _trava:
        # Outra thread pode ter carregado enquanto esperavamos a trava.
        if _modelo is not None:
            return _modelo

        try:
            from sentence_transformers import SentenceTransformer
        except ImportError as erro:
            raise EmbeddingIndisponivel(
                'sentence-transformers nao esta instalado. '
                'Instale com: pip install sentence-transformers'
            ) from erro

        logger.info('Carregando modelo de embeddings: %s', MODELO)
        _modelo = SentenceTransformer(MODELO)

    return _modelo


def gerar(texto: str) -> list[float]:
    """Converte um texto em vetor. Devolve lista de floats de tamanho DIMENSOES."""
    modelo = _carregar()

    limpo = (texto or '').strip()[:LIMITE_CARACTERES]

    if not limpo:
        raise ValueError('Nao ha texto para gerar embedding.')

    # normalize_embeddings deixa todos os vetores com norma 1, e com isso a
    # distancia do cosseno vira uma subtracao simples no Postgres.
    vetor = modelo.encode(limpo, normalize_embeddings=True)

    return vetor.tolist()


def gerar_em_lote(textos: list[str]) -> list[list[float]]:
    """
    Converte varios textos de uma vez.

    Usado na reindexacao. Processar em lote aproveita a vetorizacao interna do
    modelo e e varias vezes mais rapido do que chamar gerar() num laco.
    """
    modelo = _carregar()

    limpos = [(texto or '').strip()[:LIMITE_CARACTERES] for texto in textos]
    vetores = modelo.encode(limpos, normalize_embeddings=True, batch_size=32)

    return [vetor.tolist() for vetor in vetores]
