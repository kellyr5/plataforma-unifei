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

# Executa um passo da carga sem derrubar o servidor, mas deixando a falha
# visivel no log.
#
# A versao anterior silenciava o erro com "|| true", e o resultado foi o pior
# dos mundos: a plataforma subia vazia e o log nao dizia por que. Aqui a falha
# aparece destacada e a inicializacao continua, porque um erro de carga nao
# deve impedir o acesso ao que ja existe.
executar_passo() {
    local descricao="$1"
    shift

    echo "==> ${descricao}"

    if "$@"; then
        echo "    concluido"
    else
        echo "!!! FALHOU: ${descricao}"
        echo "!!! comando: $*"
    fi
}

executar_carga() {
    echo "==> Carga inicial ativada"

    if [ ! -f docs/ppc-cco.txt ]; then
        echo "!!! docs/ppc-cco.txt nao esta na imagem."
        echo "!!! Sem ele nao ha disciplinas, e os passos seguintes falham."
    fi

    executar_passo "Importando a matriz curricular" \
        python manage.py importar_matriz_ppc docs/ppc-cco.txt \
        --curso CCO --nome "Ciencia da Computacao" --ano 2026

    executar_passo "Criando os perfis de referencia" \
        python manage.py criar_perfis_demo --reset

    executar_passo "Populando o semestre de demonstracao" \
        python manage.py popular_demonstracao

    if [ -f docs/participantes.csv ]; then
        executar_passo "Cadastrando os participantes" \
            python manage.py cadastrar_participantes docs/participantes.csv
    fi

    echo "==> Conferindo o resultado da carga"
    python manage.py shell -c "
from autenticacao.models import Usuario
from forum.models import Disciplina, Post
print(f'    disciplinas: {Disciplina.objects.count()}')
print(f'    usuarios:    {Usuario.objects.count()}')
print(f'    publicacoes: {Post.objects.count()}')
" || echo "!!! Nao foi possivel conferir."

    echo "==> Carga inicial concluida"
}

# A carga roda em segundo plano, e o servidor sobe imediatamente.
#
# Executa-la antes do Daphne parecia natural — dados prontos antes do primeiro
# acesso — mas a plataforma de hospedagem verifica se alguma coisa esta
# escutando na porta e cancela a implantacao quando ninguem responde. Gerar as
# capas com PIL e os certificados em PDF leva alguns minutos numa instancia
# gratuita, tempo suficiente para essa verificacao falhar.
#
# Com a inversao, quem entrar nos primeiros minutos encontra a plataforma
# vazia, e depois ela se preenche. E um custo aceitavel: acontece uma unica
# vez, na primeira implantacao.
if [ "${CARGA_INICIAL:-false}" = "true" ]; then
    executar_carga &
else
    echo "==> Carga inicial desativada (CARGA_INICIAL=${CARGA_INICIAL:-nao definida})"
fi

# Saneamento dos vinculos, a cada inicializacao.
#
# Roda sempre, e nao so na carga inicial, porque e idempotente: quando nao ha
# inconsistencia, apenas relata que nao ha. O custo e uma consulta por
# disciplina, desprezivel diante do que uma base inconsistente produz — canal
# de monitoria com gente que nao monitora, fila de pedidos chegando a quem nao
# atende mais.
#
# Existe aqui porque o plano gratuito nao oferece terminal remoto: sem este
# passo, corrigir dados em producao exigiria uma implantacao com carga
# completa, que apagaria o que os participantes produziram.
# Em segundo plano, pela mesma razao da carga: o servidor precisa abrir a
# porta antes, ou a plataforma de hospedagem cancela a implantacao.
executar_passo "Saneando os vinculos com disciplinas" \
    python manage.py sanear_vinculos --aplicar &

echo "==> Subindo o Daphne na porta ${PORT:-8000}"
exec daphne -b 0.0.0.0 -p "${PORT:-8000}" config.asgi:application
