"""
Lista de refresh tokens invalidados, mantida no Redis.

O SimpleJWT oferece uma tabela no banco relacional para isso, mas o dado não
combina com o PostgreSQL: cada registro vale por poucos dias, é consultado a
cada renovação de acesso e depois vira lixo, o que produz uma tabela crescendo
sem parar e uma rotina de limpeza para acompanhar. No Redis, o próprio TTL
descarta o registro no momento em que o token expiraria, então a lista nunca
guarda nada além do que ainda pode ser usado.

Guardamos apenas o jti, que é o identificador único do token, e não o token
inteiro. Assim, mesmo que alguém tenha acesso ao Redis, não encontra ali uma
credencial utilizável.

O acesso é feito pelo framework de cache do Django, e não pelo cliente Redis
direto, para que os testes possam trocar o backend por cache em memória sem
exigir um Redis rodando.
"""

from datetime import datetime, timezone

from django.core.cache import cache
from rest_framework_simplejwt.tokens import Token


PREFIXO = 'jwt:invalidado:'


def _chave(jti: str) -> str:
    return f'{PREFIXO}{jti}'


def _segundos_ate_expirar(token: Token) -> int:
    """
    Calcula quanto tempo falta para o token expirar.

    Esse é o TTL do registro: não faz sentido guardar a invalidação de um token
    que já expirou por conta própria, porque ele seria recusado de qualquer
    forma na validação da assinatura.
    """
    expiracao = datetime.fromtimestamp(token['exp'], tz=timezone.utc)
    restante = (expiracao - datetime.now(timezone.utc)).total_seconds()

    return max(0, int(restante))


def invalidar(token: Token) -> None:
    """Marca o refresh token como usado, impedindo que seja apresentado de novo."""
    ttl = _segundos_ate_expirar(token)

    if ttl > 0:
        cache.set(_chave(token['jti']), True, timeout=ttl)


def esta_invalidado(token: Token) -> bool:
    """Informa se o refresh token já foi rotacionado ou usado em logout."""
    return cache.get(_chave(token['jti'])) is not None
