from rest_framework.permissions import BasePermission


class IsAdminOrSuperuser(BasePermission):
    """Permite acesso apenas a usuarios com is_admin=True ou is_superuser=True."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return bool(request.user.is_admin or request.user.is_superuser)


def e_administrador(usuario) -> bool:
    """Administrador global, com alcance sobre todas as disciplinas."""
    return bool(usuario and (usuario.is_admin or usuario.is_superuser))


def disciplinas_que_modera(usuario):
    """
    Devolve os ids das disciplinas em que o usuario e monitor ou professor.

    E a base da moderacao descentralizada: quem conhece o contexto da
    disciplina e quem deve julgar o conteudo dela, e nao um administrador
    global que nao acompanha a materia.
    """
    from forum.models import PermissaoDisciplina

    return PermissaoDisciplina.objects.filter(
        usuario=usuario,
        papel__in=['monitor', 'professor'],
        ativo=True,
    ).values_list('disciplina_id', flat=True)


def pode_moderar_disciplina(usuario, disciplina) -> bool:
    """
    Informa se o usuario pode moderar conteudo de uma disciplina especifica.

    O administrador passa por aqui: moderacao e supervisao, e a coordenacao
    responde pelo curso inteiro.
    """
    if e_administrador(usuario):
        return True

    return disciplina.id in set(disciplinas_que_modera(usuario))


def leciona_disciplina(usuario, disciplina) -> bool:
    """
    Informa se o usuario conduz a turma: professor ou monitor com vinculo.

    Diferente de pode_moderar_disciplina em um ponto decisivo: aqui o
    administrador nao passa. A distincao e entre supervisionar e participar.

    A coordenacao acompanha o curso e modera conteudo de qualquer disciplina,
    mas nao esta matriculada em nenhuma turma e nao leciona. Responder duvida
    de grupo, acompanhar equipes e atender a monitoria sao atos de quem conduz
    a materia naquele semestre — quem conhece a turma, o enunciado e o momento
    do conteudo. Deixar isso a cargo de um administrador global seria decidir
    sobre uma sala em que ele nao entra.

    Inclui o monitor, que participa da conducao da turma. Para os atos
    privativos do docente, use e_professor_da_disciplina.
    """
    return disciplina.id in set(disciplinas_que_modera(usuario))


def e_professor_da_disciplina(usuario, disciplina) -> bool:
    """
    Informa se o usuario e o docente responsavel pela disciplina.

    Existe porque leciona_disciplina e amplo demais para alguns atos. O monitor
    conduz a turma junto com o professor: modera conteudo, atende pedido de
    ajuda, acompanha os grupos. Mas propor trabalho, definir prazo e estabelecer
    como as equipes se formam sao decisoes de desenho da disciplina, e cabem a
    quem responde por ela perante a coordenacao.

    A distincao importa na pratica: o monitor e, quase sempre, um aluno da
    propria turma ou de periodo proximo. Autoriza-lo a criar a atividade que
    seus colegas serao avaliados inverteria a relacao que a monitoria pressupoe.

    O administrador tambem nao passa, pela mesma razao de leciona_disciplina.
    """
    from forum.models import PermissaoDisciplina

    return PermissaoDisciplina.objects.filter(
        usuario=usuario,
        disciplina=disciplina,
        papel='professor',
        ativo=True,
    ).exists()


class PodeModerar(BasePermission):
    """
    Libera a area de moderacao para administradores, monitores e professores.

    O recorte por disciplina e feito no queryset da view; aqui apenas barramos
    quem nao tem papel de moderacao em lugar nenhum.
    """

    def has_permission(self, request, view):
        usuario = request.user

        if not usuario or not usuario.is_authenticated:
            return False

        if e_administrador(usuario):
            return True

        return disciplinas_que_modera(usuario).exists()
