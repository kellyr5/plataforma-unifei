"""
Regras de negocio dos trabalhos em grupo e das conversas.

Concentra aqui o que nao cabe na view nem no model: formacao dos grupos nos
tres modos, abertura da conversa quando o grupo passa a existir e o
encaminhamento do pedido de ajuda a quem ensina.

A escolha de manter isso fora das views tem uma razao pratica: as mesmas
regras serao chamadas pela API e pelo consumer de WebSocket, e duplicar
validacao entre os dois e como as duas telas divergem com o tempo.
"""

import random

from django.db import transaction
from django.utils import timezone

from colaboracao.models import (
    Conversa,
    GrupoTrabalho,
    MembroGrupo,
    MensagemChat,
    ParticipanteConversa,
    SolicitacaoAjuda,
    Trabalho,
)
from forum.models import PermissaoDisciplina
from notificacoes.services import criar_notificacao


class RegraDeGrupo(Exception):
    """Erro de regra de negocio, tratado pela view como 400."""


def transmitir_mensagem(mensagem, request=None):
    """
    Entrega ao canal da conversa uma mensagem gravada fora do WebSocket.

    Nem toda mensagem nasce no socket: o anexo sobe por HTTP e a resposta de um
    pedido de ajuda e criada pelo servico. Sem esta transmissao, quem esta com
    a conversa aberta so veria essas mensagens ao recarregar a pagina.

    A falha de entrega e silenciosa de proposito. A mensagem ja esta no banco;
    derrubar a requisicao porque o Redis oscilou trocaria uma tela
    desatualizada por um erro visivel, o que e pior.
    """
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer

    from colaboracao.api.serializers import MensagemChatSerializer

    camada = get_channel_layer()
    if camada is None:
        return

    dados = MensagemChatSerializer(mensagem, context={'request': request}).data

    try:
        async_to_sync(camada.group_send)(
            f'conversa_{mensagem.conversa_id}',
            {'type': 'mensagem.nova', 'mensagem': dados},
        )
    except Exception:  # noqa: BLE001
        pass


def anunciar_exclusao(mensagem):
    """
    Avisa o canal da conversa que uma mensagem deixou de existir.

    A remocao e logica, mas para quem esta na conversa ela precisa ser
    imediata: sem este aviso, a mensagem continuaria na tela do outro
    participante ate o proximo recarregamento, e quem apagou acreditaria ter
    resolvido algo que continua a vista.
    """
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer

    camada = get_channel_layer()
    if camada is None:
        return

    try:
        async_to_sync(camada.group_send)(
            f'conversa_{mensagem.conversa_id}',
            {'type': 'mensagem.removida', 'mensagem_id': str(mensagem.id)},
        )
    except Exception:  # noqa: BLE001
        pass


def publicar_mensagem(mensagem, request=None):
    """
    Entrega a mensagem por WebSocket e avisa quem nao esta com a conversa aberta.

    Usada pelos caminhos que gravam a mensagem fora do socket. O consumer nao
    passa por aqui porque ja transmitiu ao proprio grupo; ele chama apenas a
    notificacao.
    """
    transmitir_mensagem(mensagem, request=request)
    notificar_mensagem(mensagem)


def notificar_mensagem(mensagem):
    """
    Avisa os demais participantes de que ha mensagem nova na conversa.

    Uma notificacao por conversa, e nao por mensagem. Enquanto o aviso
    anterior continuar nao lido, as mensagens seguintes nao geram outro: uma
    conversa de vinte mensagens produziria vinte avisos identicos, e o sino
    deixaria de ser util justamente para quem mais usa a plataforma.

    O texto leva o inicio da mensagem porque, na maioria das vezes, ler o
    trecho ja responde se vale a pena abrir agora ou depois.
    """
    from django.contrib.contenttypes.models import ContentType

    from notificacoes.models import Notificacao

    conversa = mensagem.conversa
    tipo_conversa = ContentType.objects.get_for_model(Conversa)

    destinatarios = conversa.participantes.exclude(
        usuario=mensagem.autor
    ).select_related('usuario')

    ja_avisados = set(
        Notificacao.objects.filter(
            tipo='mensagem_grupo',
            content_type=tipo_conversa,
            objeto_id=conversa.id,
            lida=False,
        ).values_list('destinatario_id', flat=True)
    )

    trecho = (mensagem.conteudo or '').strip()
    if not trecho:
        trecho = f'Enviou um arquivo: {mensagem.nome_original or "anexo"}.'

    for participante in destinatarios:
        if participante.usuario_id in ja_avisados:
            continue

        criar_notificacao(
            destinatario=participante.usuario,
            tipo='mensagem_grupo',
            titulo=f'Nova mensagem em {conversa.titulo}',
            mensagem=trecho[:200],
            remetente=mensagem.autor,
            objeto_relacionado=conversa,
        )


# ===== Formacao dos grupos =====

def matriculados(disciplina):
    """Estudantes da turma, na ordem do nome."""
    return [
        vinculo.usuario
        for vinculo in PermissaoDisciplina.objects.filter(
            disciplina=disciplina, papel='aluno', ativo=True,
        ).select_related('usuario').order_by('usuario__nome_completo')
    ]


@transaction.atomic
def criar_grupos_vazios(trabalho):
    """
    Cria os grupos previstos, ainda sem participantes.

    Serve ao modo em que os alunos se organizam: eles precisam de grupos
    existentes para escolher onde entrar. Os nomes sao sequenciais e o
    professor pode renomear depois.
    """
    existentes = trabalho.grupos.count()

    novos = [
        GrupoTrabalho(trabalho=trabalho, nome=f'Grupo {numero}')
        for numero in range(existentes + 1, trabalho.total_grupos + 1)
    ]

    GrupoTrabalho.objects.bulk_create(novos)

    for grupo in trabalho.grupos.all():
        abrir_conversa_do_grupo(grupo)

    return trabalho.grupos.count()


@transaction.atomic
def sortear_grupos(trabalho):
    """
    Distribui os matriculados entre os grupos, por sorteio.

    A distribuicao e circular, e nao sequencial: em vez de encher o primeiro
    grupo antes de comecar o segundo, cada pessoa vai para o grupo seguinte.
    Assim a diferenca de tamanho entre grupos nunca passa de um, o que evita
    a situacao de tres grupos cheios e um com uma pessoa so.
    """
    if trabalho.grupos.filter(membros__isnull=False).exists():
        raise RegraDeGrupo(
            'Ja existem grupos com participantes. Desfaca a divisao antes de sortear.'
        )

    turma = matriculados(trabalho.disciplina)

    if not turma:
        raise RegraDeGrupo('A disciplina nao tem estudantes matriculados.')

    if len(turma) > trabalho.vagas_totais:
        raise RegraDeGrupo(
            f'A turma tem {len(turma)} estudante(s) e a divisao comporta '
            f'{trabalho.vagas_totais}. Aumente o numero de grupos ou o tamanho.'
        )

    trabalho.grupos.all().delete()
    criar_grupos_vazios(trabalho)

    grupos = list(trabalho.grupos.all())
    random.shuffle(turma)

    membros = [
        MembroGrupo(
            grupo=grupos[indice % len(grupos)],
            usuario=estudante,
            # O primeiro de cada grupo entra como lider provisorio; o grupo
            # pode trocar depois.
            e_lider=indice < len(grupos),
        )
        for indice, estudante in enumerate(turma)
    ]

    MembroGrupo.objects.bulk_create(membros)

    for grupo in grupos:
        sincronizar_participantes(grupo)

    return len(membros)


@transaction.atomic
def entrar_no_grupo(grupo, usuario):
    """
    Adiciona alguem a um grupo, respeitando as regras do trabalho.

    Tres verificacoes, nesta ordem: a pessoa cursa a disciplina, ainda nao
    esta em outro grupo do mesmo trabalho, e ha vaga. A ordem importa para a
    mensagem de erro fazer sentido a quem clicou.
    """
    trabalho = grupo.trabalho

    if trabalho.encerrado:
        raise RegraDeGrupo('Este trabalho ja foi encerrado.')

    cursa = PermissaoDisciplina.objects.filter(
        usuario=usuario, disciplina=trabalho.disciplina, papel='aluno', ativo=True,
    ).exists()

    if not cursa:
        raise RegraDeGrupo('Apenas estudantes matriculados na disciplina participam.')

    ja_em_outro = MembroGrupo.objects.filter(
        grupo__trabalho=trabalho, usuario=usuario,
    ).exclude(grupo=grupo).first()

    if ja_em_outro:
        raise RegraDeGrupo(
            f'Voce ja participa do {ja_em_outro.grupo.nome} neste trabalho. '
            'Saia dele antes de entrar em outro.'
        )

    if grupo.esta_cheio:
        raise RegraDeGrupo(
            f'O {grupo.nome} ja tem {trabalho.tamanho_maximo} participante(s).'
        )

    # O primeiro a entrar assume a lideranca, que o grupo pode trocar depois.
    primeiro = not grupo.membros.exists()

    membro, criado = MembroGrupo.objects.get_or_create(
        grupo=grupo,
        usuario=usuario,
        defaults={'e_lider': primeiro},
    )

    if criado:
        sincronizar_participantes(grupo)

    return membro


@transaction.atomic
def sair_do_grupo(grupo, usuario):
    """
    Remove alguem do grupo e transfere a lideranca se preciso.

    Grupo sem lider trava a organizacao, entao quando o lider sai a lideranca
    passa a quem entrou primeiro entre os que ficaram.

    A saida da conversa passa por sincronizar_participantes, e nao por uma
    remocao direta. Ter um unico lugar que alinha as duas listas evita que
    entrada e saida divirjam com o tempo, que e como um ex-membro acaba
    continuando a ler o chat do grupo.
    """
    membro = MembroGrupo.objects.filter(grupo=grupo, usuario=usuario).first()

    if membro is None:
        raise RegraDeGrupo('Voce nao participa deste grupo.')

    era_lider = membro.e_lider
    membro.delete()

    if era_lider:
        proximo = grupo.membros.order_by('created_at').first()
        if proximo:
            proximo.e_lider = True
            proximo.save(update_fields=['e_lider'])

    sincronizar_participantes(grupo)


@transaction.atomic
def definir_lider(grupo, usuario):
    """
    Troca a lideranca do grupo, garantindo que haja apenas um lider.

    Aceita o objeto do usuario ou o identificador, porque a view recebe o id
    vindo do corpo da requisicao.
    """
    if not usuario:
        raise RegraDeGrupo('Informe quem sera o lider.')

    membro = MembroGrupo.objects.filter(grupo=grupo, usuario_id=getattr(
        usuario, 'id', usuario
    )).first()

    if membro is None:
        raise RegraDeGrupo('Esta pessoa nao participa do grupo.')

    grupo.membros.update(e_lider=False)
    membro.e_lider = True
    membro.save(update_fields=['e_lider'])

    return membro


# ===== Conversas =====

def abrir_conversa_do_grupo(grupo):
    """
    Garante a conversa privada do grupo.

    Criada junto com o grupo, e nao no primeiro acesso, para que a lista de
    participantes acompanhe a composicao desde o inicio e ninguem precise
    abrir o chat para passar a receber notificacao dele.
    """
    conversa, criada = Conversa.objects.get_or_create(
        grupo=grupo,
        defaults={
            'tipo': 'grupo',
            'disciplina': grupo.trabalho.disciplina,
            'titulo': f'{grupo.nome} · {grupo.trabalho.titulo}',
            'semestre': grupo.trabalho.disciplina.semestre,
        },
    )

    if criada:
        sincronizar_participantes(grupo)

    return conversa


def sincronizar_participantes(grupo):
    """
    Alinha os participantes da conversa com a composicao do grupo.

    Chamado sempre que alguem entra ou sai. Manter as duas listas separadas
    e o preco de a conversa servir tambem a turma e a mensagem privada, onde
    nao existe grupo por tras.
    """
    conversa = getattr(grupo, 'conversa', None)

    if conversa is None:
        conversa = abrir_conversa_do_grupo(grupo)

    atuais = set(grupo.membros.values_list('usuario_id', flat=True))
    inscritos = set(conversa.participantes.values_list('usuario_id', flat=True))

    ParticipanteConversa.objects.bulk_create([
        ParticipanteConversa(conversa=conversa, usuario_id=usuario_id)
        for usuario_id in atuais - inscritos
    ])

    conversa.participantes.filter(usuario_id__in=inscritos - atuais).delete()

    return conversa


@transaction.atomic
def garantir_canal_de_monitoria(disciplina):
    """
    Cria ou atualiza o canal entre quem conduz a disciplina.

    Reune professores e monitores daquela materia, e apenas daquela. Ate aqui,
    o monitor que precisava alinhar uma correcao com o professor recorria a
    canal externo, ou entrava na fila de pedidos de ajuda, que existe para
    duvida de aluno e traz o recorte errado.

    O canal so existe quando ha monitoria constituida: sem monitor, seria uma
    conversa do professor consigo mesmo, e ela apareceria na lista dele sem
    servir para nada.

    A funcao e idempotente. Chamada a cada mudanca de vinculo, ela acerta a
    lista de participantes sem duplicar a conversa.
    """
    vinculos = PermissaoDisciplina.objects.filter(
        disciplina=disciplina,
        ativo=True,
        papel__in=['professor', 'monitor'],
    )

    conduzem = set(vinculos.values_list('usuario_id', flat=True))
    ha_monitor = vinculos.filter(papel='monitor').exists()

    conversa = Conversa.objects.filter(
        tipo='monitoria', disciplina=disciplina,
    ).first()

    if not ha_monitor:
        # Perdeu a monitoria: o canal para de aceitar mensagem, mas o
        # historico permanece. Apagar eliminaria o registro de combinacoes que
        # podem ter valido para a turma inteira. O arquivamento e o mecanismo
        # que ja existe para deixar uma conversa em somente leitura.
        if conversa is not None and conversa.arquivada_em is None:
            conversa.arquivada_em = timezone.now()
            conversa.save(update_fields=['arquivada_em'])
        return conversa

    if conversa is None:
        conversa = Conversa.objects.create(
            tipo='monitoria',
            disciplina=disciplina,
            titulo=f'Monitoria de {disciplina.codigo}',
        )
    elif conversa.arquivada_em is not None:
        # A monitoria foi reconstituida: o canal volta a aceitar mensagem.
        conversa.arquivada_em = None
        conversa.save(update_fields=['arquivada_em'])

    inscritos = set(conversa.participantes.values_list('usuario_id', flat=True))

    ParticipanteConversa.objects.bulk_create([
        ParticipanteConversa(conversa=conversa, usuario_id=usuario_id)
        for usuario_id in conduzem - inscritos
    ])

    # Quem perdeu o vinculo sai do canal. O historico das mensagens dele
    # permanece, porque apagar reescreveria a conversa dos demais.
    conversa.participantes.filter(
        usuario_id__in=inscritos - conduzem,
    ).delete()

    return conversa


def pode_ver_conversa(usuario, conversa):
    """
    Quem enxerga a conversa.

    O professor nao entra na conversa de grupo, mesmo sendo responsavel pela
    disciplina. Foi decisao de projeto: a privacidade do grupo e o que faz os
    alunos usarem a plataforma em vez de migrarem para aplicativos externos.
    O que chega a ele e apenas a mensagem marcada como duvida.
    """
    if usuario.is_superuser:
        return True

    return conversa.participantes.filter(usuario=usuario).exists()


@transaction.atomic
def registrar_leitura(conversa, usuario, momento=None):
    """Marca ate onde a pessoa leu, para o contador de nao lidas."""
    ParticipanteConversa.objects.filter(conversa=conversa, usuario=usuario).update(
        lido_ate=momento or timezone.now()
    )


def nao_lidas(conversa, usuario):
    """Quantas mensagens chegaram depois da ultima leitura da pessoa."""
    participante = conversa.participantes.filter(usuario=usuario).first()

    if participante is None:
        return 0

    mensagens = conversa.mensagens.filter(deleted_at__isnull=True).exclude(autor=usuario)

    if participante.lido_ate:
        mensagens = mensagens.filter(created_at__gt=participante.lido_ate)

    return mensagens.count()


# ===== Pedido de ajuda =====

def destinatarios_de_ajuda(disciplina, destino):
    """
    Quem recebe o pedido, conforme a disciplina tenha ou nao monitoria.

    Disciplina sem monitor cai no professor sem que o aluno precise saber
    disso: ele pede ajuda, e o sistema resolve para quem vai.
    """
    papeis = {
        'monitoria': ['monitor'],
        'professor': ['professor'],
        'ambos': ['monitor', 'professor'],
    }[destino]

    vinculos = PermissaoDisciplina.objects.filter(
        disciplina=disciplina, papel__in=papeis, ativo=True,
    ).select_related('usuario')

    pessoas = [vinculo.usuario for vinculo in vinculos]

    if pessoas:
        return pessoas

    # Sem ninguem no destino pedido, o professor assume.
    professores = PermissaoDisciplina.objects.filter(
        disciplina=disciplina, papel='professor', ativo=True,
    ).select_related('usuario')

    return [vinculo.usuario for vinculo in professores]


@transaction.atomic
def pedir_ajuda(mensagem, solicitante, descricao='', destino='ambos'):
    """
    Cria o pedido a partir de uma mensagem do chat e avisa quem ensina.

    Qualquer membro do grupo pode marcar, e nao apenas quem escreveu: muitas
    vezes quem percebe que a duvida trancou a discussao e outra pessoa.
    """
    conversa = mensagem.conversa

    if not pode_ver_conversa(solicitante, conversa):
        raise RegraDeGrupo('Voce nao participa desta conversa.')

    if SolicitacaoAjuda.objects.filter(
        mensagem=mensagem, status__in=['aberta', 'em_atendimento'],
    ).exists():
        raise RegraDeGrupo('Esta mensagem ja tem um pedido de ajuda em aberto.')

    solicitacao = SolicitacaoAjuda.objects.create(
        mensagem=mensagem,
        solicitante=solicitante,
        descricao=descricao.strip(),
        destino=destino,
    )

    disciplina = conversa.disciplina

    for pessoa in destinatarios_de_ajuda(disciplina, destino):
        criar_notificacao(
            destinatario=pessoa,
            tipo='ajuda_solicitada',
            titulo=f'Pedido de ajuda em {disciplina.codigo}',
            mensagem=(
                f'{solicitante.nome_completo} marcou uma mensagem como duvida.'
                + (f' {descricao.strip()}' if descricao.strip() else '')
            ),
            remetente=solicitante,
            objeto_relacionado=disciplina,
        )

    return solicitacao


@transaction.atomic
def responder_ajuda(solicitacao, quem_responde, resposta):
    """
    Registra a resposta e devolve o retorno ao chat do grupo.

    A resposta entra como mensagem na propria conversa, encadeada ao contexto
    original, para que o grupo inteiro veja a solucao onde a duvida nasceu.
    """
    texto = resposta.strip()

    if not texto:
        raise RegraDeGrupo('Escreva a resposta antes de enviar.')

    solicitacao.resposta = texto
    solicitacao.atendido_por = quem_responde
    solicitacao.respondido_em = timezone.now()
    solicitacao.status = 'resolvida'
    solicitacao.save()

    retorno = MensagemChat.objects.create(
        conversa=solicitacao.mensagem.conversa,
        autor=quem_responde,
        conteudo=texto,
    )

    publicar_mensagem(retorno)

    criar_notificacao(
        destinatario=solicitacao.solicitante,
        tipo='ajuda_respondida',
        titulo='Seu pedido de ajuda foi respondido',
        mensagem=texto[:200],
        remetente=quem_responde,
        objeto_relacionado=solicitacao.mensagem.conversa.disciplina,
    )

    return solicitacao
