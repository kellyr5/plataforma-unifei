"""
Acervo de arquivos da pessoa.

O material circula por tres caminhos diferentes na plataforma: anexo de
mensagem numa conversa, material de apoio preso ao enunciado de um trabalho e
anexo de publicacao no forum. Cada um vive num modelo proprio, e ate aqui a
unica forma de reencontrar um arquivo era lembrar por onde ele passou —
descer a conversa de tres semanas atras ate achar o PDF.

O que este modulo faz e reunir as tres origens numa lista so, agrupada por
disciplina, que e como as pessoas de fato organizam o semestre. Nao ha modelo
novo nem copia de arquivo: a consulta le o que ja existe.

O recorte de permissao e o mesmo de cada origem, e nao um novo:
  - anexo de conversa: quem participa da conversa;
  - material de trabalho: quem tem vinculo com a disciplina;
  - anexo de publicacao: quem tem vinculo com a disciplina.

Nenhum arquivo aparece aqui que a pessoa nao pudesse abrir pelo caminho
original. Isto e deliberado: um agregador que afrouxa o controle de acesso
transforma conveniencia em vazamento.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from forum.models import Arquivo as ArquivoPost
from forum.models import PermissaoDisciplina

from .models import ArquivoTrabalho, MensagemChat


@dataclass(frozen=True)
class ItemAcervo:
    """
    Um arquivo, descrito de forma independente de onde veio.

    A origem vira rotulo em vez de tipo, porque quem procura um arquivo pensa
    em "aquele PDF do trabalho", e nao no modelo que o guarda.
    """

    id: str
    nome: str
    url: str
    tamanho_bytes: int
    tipo_mime: str
    origem: str
    origem_rotulo: str
    contexto: str
    contexto_url: str
    enviado_por: str
    enviado_por_id: str
    data: datetime
    disciplina_id: str | None
    disciplina_codigo: str
    disciplina_nome: str


def _disciplinas_do_usuario(usuario) -> list[str]:
    """Identificadores das disciplinas em que a pessoa tem vinculo ativo."""
    return list(
        PermissaoDisciplina.objects
        .filter(usuario=usuario, ativo=True)
        .values_list('disciplina_id', flat=True)
    )


def _anexos_de_conversa(usuario) -> list[ItemAcervo]:
    """
    Arquivos trocados nas conversas de que a pessoa participa.

    A mensagem apagada nao entra. Ela continua na tabela por causa da exclusao
    logica, mas quem apagou uma mensagem espera que o anexo va junto — reapare-
    cer numa outra tela seria desfazer a decisao pelas costas.
    """
    consulta = (
        MensagemChat.objects
        .filter(
            conversa__participantes__usuario=usuario,
            deleted_at__isnull=True,
        )
        .exclude(arquivo='')
        .exclude(arquivo__isnull=True)
        .select_related('autor', 'conversa', 'conversa__disciplina', 'conversa__grupo')
        .order_by('-created_at')
        .distinct()
    )

    itens: list[ItemAcervo] = []

    for mensagem in consulta:
        conversa = mensagem.conversa
        disciplina = conversa.disciplina

        if conversa.tipo == 'grupo' and conversa.grupo_id:
            contexto = conversa.grupo.nome
            contexto_url = f'/conversas/{conversa.id}'
        elif conversa.tipo == 'disciplina':
            contexto = 'Conversa da turma'
            contexto_url = f'/conversas/{conversa.id}'
        else:
            contexto = conversa.titulo or 'Conversa privada'
            contexto_url = f'/conversas/{conversa.id}'

        itens.append(ItemAcervo(
            id=str(mensagem.id),
            nome=mensagem.nome_original or 'arquivo',
            url=mensagem.arquivo.url,
            # A mensagem nao guarda o tamanho, e perguntar ao arquivo custaria
            # uma consulta ao armazenamento por anexo — no S3, uma chamada de
            # rede para cada linha da lista. O tamanho e informacao secundaria
            # aqui; melhor omitir do que tornar a tela lenta para obte-la.
            tamanho_bytes=0,
            tipo_mime='',
            origem='conversa',
            origem_rotulo='Conversa',
            contexto=contexto,
            contexto_url=contexto_url,
            enviado_por=mensagem.autor.nome_completo,
            enviado_por_id=str(mensagem.autor_id),
            data=mensagem.created_at,
            disciplina_id=str(disciplina.id) if disciplina else None,
            disciplina_codigo=disciplina.codigo if disciplina else '',
            disciplina_nome=disciplina.nome if disciplina else 'Sem disciplina',
        ))

    return itens


def _materiais_de_trabalho(disciplinas: list[str]) -> list[ItemAcervo]:
    """Material de apoio que acompanha o enunciado dos trabalhos da turma."""
    consulta = (
        ArquivoTrabalho.objects
        .filter(trabalho__disciplina_id__in=disciplinas)
        .select_related('enviado_por', 'trabalho', 'trabalho__disciplina')
        .order_by('-created_at')
    )

    return [
        ItemAcervo(
            id=str(item.id),
            nome=item.nome_original,
            url=item.arquivo.url,
            tamanho_bytes=item.tamanho_bytes,
            tipo_mime=item.tipo_mime,
            origem='trabalho',
            origem_rotulo='Material do trabalho',
            contexto=item.trabalho.titulo,
            contexto_url='/trabalhos',
            enviado_por=item.enviado_por.nome_completo,
            enviado_por_id=str(item.enviado_por_id),
            data=item.created_at,
            disciplina_id=str(item.trabalho.disciplina_id),
            disciplina_codigo=item.trabalho.disciplina.codigo,
            disciplina_nome=item.trabalho.disciplina.nome,
        )
        for item in consulta
    ]


def _anexos_de_publicacao(disciplinas: list[str]) -> list[ItemAcervo]:
    """Anexos das publicacoes do forum nas disciplinas da pessoa."""
    consulta = (
        ArquivoPost.objects
        .filter(
            post__disciplina_id__in=disciplinas,
            post__deleted_at__isnull=True,
        )
        .select_related('post', 'post__autor', 'post__disciplina')
        .order_by('-created_at')
    )

    return [
        ItemAcervo(
            id=str(item.id),
            nome=item.nome_original,
            url=item.arquivo.url,
            tamanho_bytes=item.tamanho_bytes,
            tipo_mime=item.tipo_mime,
            origem='forum',
            origem_rotulo='Publicação no fórum',
            contexto=item.post.titulo or 'Resposta',
            contexto_url=f'/forum/{item.post_id}',
            enviado_por=item.post.autor.nome_completo,
            enviado_por_id=str(item.post.autor_id),
            data=item.created_at,
            disciplina_id=str(item.post.disciplina_id),
            disciplina_codigo=item.post.disciplina.codigo,
            disciplina_nome=item.post.disciplina.nome,
        )
        for item in consulta
    ]


def montar_acervo(usuario) -> list[dict]:
    """
    Todos os arquivos ao alcance da pessoa, agrupados por disciplina.

    A ordenacao dentro de cada grupo e do mais recente para o mais antigo,
    porque a busca costuma ser por algo visto ha pouco. Entre os grupos, o
    criterio e o codigo da disciplina, que e estavel e previsivel — ordenar
    por atividade faria os blocos trocarem de lugar entre uma visita e outra.
    """
    disciplinas = _disciplinas_do_usuario(usuario)

    itens = (
        _anexos_de_conversa(usuario)
        + _materiais_de_trabalho(disciplinas)
        + _anexos_de_publicacao(disciplinas)
    )

    grupos: dict[str, dict] = {}

    for item in itens:
        chave = item.disciplina_codigo or 'sem-disciplina'

        if chave not in grupos:
            grupos[chave] = {
                'disciplina_id': item.disciplina_id,
                'disciplina_codigo': item.disciplina_codigo,
                'disciplina_nome': item.disciplina_nome,
                'arquivos': [],
            }

        grupos[chave]['arquivos'].append({
            'id': item.id,
            'nome': item.nome,
            'url': item.url,
            'tamanho_bytes': item.tamanho_bytes,
            'tipo_mime': item.tipo_mime,
            'origem': item.origem,
            'origem_rotulo': item.origem_rotulo,
            'contexto': item.contexto,
            'contexto_url': item.contexto_url,
            'enviado_por': item.enviado_por,
            'enviado_por_id': item.enviado_por_id,
            'enviado_por_mim': item.enviado_por_id == str(usuario.id),
            'data': item.data,
        })

    for grupo in grupos.values():
        grupo['arquivos'].sort(key=lambda a: a['data'], reverse=True)
        grupo['total'] = len(grupo['arquivos'])

    # A disciplina sem codigo — anexo de conversa privada — vai para o fim.
    return sorted(
        grupos.values(),
        key=lambda g: (g['disciplina_codigo'] == '', g['disciplina_codigo']),
    )
