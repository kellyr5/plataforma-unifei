"""
Fábricas compartilhadas pelos testes automatizados da plataforma.

A ideia aqui é centralizar a criação de usuários, disciplinas, vínculos e
oportunidades num lugar só, para que os testes de cada app fiquem curtos e
focados na regra que estão verificando, sem repetir setUp em todo arquivo.

Uso típico dentro de um teste:

    from config.testing import criar_usuario, criar_disciplina, vincular

    aluno = criar_usuario(nome='Aluno Teste')
    disciplina = criar_disciplina()
    vincular(aluno, disciplina, papel='monitor')
"""

from datetime import timedelta

from django.utils import timezone

from autenticacao.models import RoleGlobal, Usuario
from forum.models import Disciplina, PermissaoDisciplina, Post
from voluntariado.models import Oportunidade


# Senha usada por todos os usuários de teste, já dentro das regras de
# validação do Django (tamanho mínimo, não numérica, não comum).
SENHA_PADRAO = 'SenhaForte2026.'

# O CPF é único no banco, então cada usuário criado recebe o próximo número
# da sequência. Não são CPFs válidos pelo dígito verificador, mas o model não
# faz essa checagem, apenas o serializer de registro.
_contador_cpf = {'valor': 10000000000}


# ===== Leitura de respostas paginadas =====

def itens(resposta):
    """
    Devolve a lista de registros de uma resposta da API.

    Com a paginação ativa, uma listagem retorna um dicionário com count, next,
    previous e results. Endpoints que não passam pelo paginador, como as views
    avulsas de reputação, continuam devolvendo a lista direta. Este auxiliar
    aceita os dois formatos, para que os testes não precisem saber qual é qual.
    """
    dados = resposta.data

    if isinstance(dados, dict) and 'results' in dados:
        return dados['results']

    return dados


# ===== Usuários =====

def proximo_cpf():
    """Devolve um CPF sequencial, garantindo unicidade dentro do banco de teste."""
    _contador_cpf['valor'] += 1
    return str(_contador_cpf['valor'])


def criar_usuario(nome='Usuário Teste', email=None, ativo=True, admin=False, ong=False):
    """
    Cria um usuário pronto para autenticar nos testes.

    Por padrão o usuário já nasce ativo, porque a maior parte dos testes trata
    de funcionalidades internas e não do fluxo de ativação. Quem precisa testar
    o cadastro passa ativo=False.
    """
    cpf = proximo_cpf()

    usuario = Usuario.objects.create_user(
        cpf=cpf,
        email=email or f'{cpf}@unifei.edu.br',
        nome_completo=nome,
        password=SENHA_PADRAO,
    )
    usuario.ativo = ativo
    usuario.is_admin = admin
    usuario.save()

    # O papel de organização é global, não depende de disciplina.
    if ong:
        RoleGlobal.objects.create(usuario=usuario, role='ong')

    return usuario


# ===== Fórum =====

def criar_disciplina(codigo='XAHC01', nome='Algoritmos e Estruturas de Dados'):
    """Cria uma disciplina ativa do semestre corrente."""
    return Disciplina.objects.create(
        codigo=codigo,
        nome=nome,
        curso='Ciência da Computação',
        semestre='2026.1',
    )


def vincular(usuario, disciplina, papel='aluno'):
    """Vincula um usuário a uma disciplina com o papel informado."""
    return PermissaoDisciplina.objects.create(
        usuario=usuario,
        disciplina=disciplina,
        papel=papel,
    )


def criar_topico(autor, disciplina, titulo='Dúvida sobre complexidade'):
    """Cria um tópico, ou seja, um post sem post_pai."""
    return Post.objects.create(
        disciplina=disciplina,
        autor=autor,
        titulo=titulo,
        conteudo='Não entendi a análise assintótica do quicksort.',
    )


def criar_resposta(autor, topico, conteudo='O pior caso é O(n^2).'):
    """Cria uma resposta encadeada a um tópico. Respostas não têm título."""
    return Post.objects.create(
        disciplina=topico.disciplina,
        autor=autor,
        post_pai=topico,
        conteudo=conteudo,
    )


# ===== Voluntariado =====

def criar_oportunidade(organizacao, vagas=2, requer_aprovacao=True, prazo_dias=30):
    """
    Cria uma oportunidade aberta a inscrições.

    As datas são calculadas a partir de hoje para que a oportunidade esteja
    sempre dentro do prazo, independentemente de quando o teste rodar.
    """
    hoje = timezone.now().date()

    return Oportunidade.objects.create(
        organizacao=organizacao,
        titulo='Monitoria em escola pública',
        descricao='Apoio a alunos do ensino fundamental em matemática.',
        area='educacao',
        local='Itajubá - MG',
        vagas=vagas,
        carga_horaria_total=40,
        data_inicio=hoje + timedelta(days=prazo_dias + 1),
        data_fim=hoje + timedelta(days=prazo_dias + 30),
        prazo_inscricao=hoje + timedelta(days=prazo_dias),
        requer_aprovacao=requer_aprovacao,
    )
