#!/usr/bin/env bash
#
# Inicializacao da aplicacao em producao.
#
# A ordem importa: migrar antes de subir o servidor evita que a primeira
# requisicao encontre tabela inexistente, e coletar os estaticos depois da
# migracao garante que o manifesto do WhiteNoise exista quando alguem pedir a
# primeira pagina.

set -o errexit
set -o pipefail
set -o nounset

echo "==> Aplicando migracoes"
python manage.py migrate --noinput

echo "==> Coletando arquivos estaticos"
python manage.py collectstatic --noinput

# A carga inicial roda uma unica vez, na primeira implantacao. Repeti-la a
# cada reinicio apagaria o que os participantes produziram durante o teste,
# que e justamente o dado que queremos observar.
if [ "${CARGA_INICIAL:-false}" = "true" ]; then
    echo "==> Importando a matriz curricular"
    python manage.py importar_matriz_ppc docs/ppc-cco.txt \
        --curso CCO --nome "Ciencia da Computacao" --ano 2026 || true

    echo "==> Criando os perfis de referencia"
    python manage.py criar_perfis_demo --reset || true

    echo "==> Populando o semestre de demonstracao"
    python manage.py popular_demonstracao || true

    if [ -f docs/participantes.csv ]; then
        echo "==> Cadastrando os participantes"
        python manage.py cadastrar_participantes docs/participantes.csv || true
    fi
fi

echo "==> Subindo o Daphne na porta ${PORT:-8000}"
exec daphne -b 0.0.0.0 -p "${PORT:-8000}" config.asgi:application
