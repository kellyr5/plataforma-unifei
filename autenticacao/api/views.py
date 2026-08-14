"""
Views de registro, ativacao de conta e reenvio de codigo OTP.

O fluxo segue o padrao OTP-based registration:
1. POST /register/ -- cria usuario inativo, gera codigo, envia email
2. POST /ativar/ -- valida codigo, ativa conta, retorna tokens JWT
3. POST /reenviar-codigo/ -- gera novo codigo se o anterior expirou
"""

from rest_framework import status, permissions
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from drf_spectacular.utils import extend_schema

from autenticacao.models import Usuario
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.views import TokenRefreshView

from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404

from auditoria.services import registrar_acao
from config.permissions import IsAdminOrSuperuser

from autenticacao.api.serializers import (
    RegistroSerializer,
    AtivacaoSerializer,
    ReenvioCodigoSerializer,
    LogoutSerializer,
    PreCadastroSerializer,
    RefreshComListaRedisSerializer,
    UsuarioResumoSerializer,
)
from autenticacao.tokens import invalidar
from autenticacao.utils import (
    criar_codigo_ativacao,
    enviar_email_ativacao,
    validar_codigo_ativacao,
)


class EstatisticasPublicasView(APIView):
    """
    GET /api/auth/estatisticas/

    Numeros exibidos na tela de entrada, antes de qualquer autenticacao.

    Existe porque a tela mostrava valores fixos escritos no codigo. Numero
    inventado numa tela institucional e um problema de credibilidade: quem
    perguntar de onde vem nao tem resposta. Aqui os tres vem de contagem real,
    e a tela passa a dizer a verdade mesmo quando a verdade e zero.

    Sao agregados, sem identificar ninguem, o que permite servir a visitantes
    nao autenticados sem expor dado pessoal.
    """

    permission_classes = [permissions.AllowAny]

    @extend_schema(
        responses={200: dict},
        description='Contagens agregadas para a tela de entrada.',
    )
    def get(self, request):
        from forum.models import Post
        from voluntariado.models import Certificado

        return Response({
            'estudantes': Usuario.objects.filter(
                ativo=True, deleted_at__isnull=True,
            ).count(),
            'topicos': Post.objects.filter(
                post_pai__isnull=True, deleted_at__isnull=True,
            ).count(),
            'certificados': Certificado.objects.count(),
        })


class RegistroView(APIView):
    """
    POST /api/auth/register/

    Cria um novo usuario com status inativo e dispara o email de ativacao.
    Nao retorna tokens; usuario precisa ativar a conta antes de logar.
    """

    permission_classes = [permissions.AllowAny]

    @extend_schema(
        request=RegistroSerializer,
        responses={201: dict},
        tags=['Autenticacao'],
        summary='Registrar novo usuario',
    )
    def post(self, request):
        serializer = RegistroSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        usuario = serializer.save()

        codigo_texto, _ = criar_codigo_ativacao(usuario, tipo='ativacao')

        try:
            enviar_email_ativacao(usuario, codigo_texto)
        except Exception as e:
            # Em desenvolvimento (console backend) nao deve falhar.
            # Em producao, idealmente enfileirar email com Celery.
            return Response(
                {
                    'detail': 'Cadastro criado, mas houve falha ao enviar o email. '
                              'Use o endpoint /reenviar-codigo/ para tentar novamente.',
                    'erro': str(e),
                },
                status=status.HTTP_201_CREATED,
            )

        return Response(
            {
                'detail': 'Cadastro realizado com sucesso. '
                          'Verifique seu email para o codigo de ativacao.',
                'email': usuario.email,
            },
            status=status.HTTP_201_CREATED,
        )


class AtivacaoView(APIView):
    """
    POST /api/auth/ativar/

    Valida o codigo OTP e ativa a conta do usuario. Em caso de sucesso,
    retorna os tokens JWT (access e refresh) prontos para uso.
    """

    permission_classes = [permissions.AllowAny]

    @extend_schema(
        request=AtivacaoSerializer,
        responses={200: dict},
        tags=['Autenticacao'],
        summary='Ativar conta de usuario',
    )
    
    def post(self, request):
        serializer = AtivacaoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email'].lower().strip()
        codigo = serializer.validated_data['codigo']

        try:
            usuario = Usuario.objects.get(email__iexact=email)
        except Usuario.DoesNotExist:
            # Mensagem generica para nao expor existencia de email no sistema
            return Response(
                {'detail': 'Email ou codigo invalido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if usuario.ativo:
            return Response(
                {'detail': 'Esta conta ja esta ativa. Use o login normalmente.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        sucesso, mensagem_erro = validar_codigo_ativacao(usuario, codigo, tipo='ativacao')

        if not sucesso:
            return Response(
                {'detail': mensagem_erro},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Ativa a conta
        usuario.ativo = True
        usuario.save(update_fields=['ativo'])

        # Gera tokens JWT
        refresh = RefreshToken.for_user(usuario)

        return Response(
            {
                'detail': 'Conta ativada com sucesso.',
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            },
            status=status.HTTP_200_OK,
        )


class ReenvioCodigoView(APIView):
    """
    POST /api/auth/reenviar-codigo/

    Gera um novo codigo de ativacao para usuario ainda inativo.
    Para evitar enumeration attacks (descobrir quais emails estao cadastrados),
    sempre retorna sucesso, mesmo se o email nao existir.
    """

    permission_classes = [permissions.AllowAny]

    @extend_schema(
        request=ReenvioCodigoSerializer,
        responses={200: dict},
        tags=['Autenticacao'],
        summary='Reenviar codigo de ativacao',
    )
    
    def post(self, request):
        serializer = ReenvioCodigoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email'].lower().strip()
        usuario = Usuario.objects.filter(email__iexact=email, ativo=False).first()

        # Importante: sempre retornar a mesma mensagem para evitar enumeration
        resposta_padrao = Response(
            {
                'detail': 'Se o email estiver cadastrado e inativo, '
                          'um novo codigo de ativacao sera enviado.',
            },
            status=status.HTTP_200_OK,
        )

        if not usuario:
            return resposta_padrao

        codigo_texto, _ = criar_codigo_ativacao(usuario, tipo='ativacao')

        try:
            enviar_email_ativacao(usuario, codigo_texto)
        except Exception:
            pass  # Falha silenciosa para nao expor erro ao atacante

        return resposta_padrao


class BuscaUsuarioView(APIView):
    """
    GET /api/auth/usuarios/?busca=texto

    Consulta de pessoas para as telas de atribuicao da coordenacao.

    Exige ao menos tres caracteres e devolve poucos resultados de proposito:
    e um campo de busca para encontrar alguem conhecido, nao uma listagem
    navegavel de toda a base de usuarios.
    """

    permission_classes = [IsAdminOrSuperuser]

    @extend_schema(
        responses={200: UsuarioResumoSerializer(many=True)},
        tags=['Autenticacao'],
        summary='Buscar pessoas para atribuicao',
    )
    def get(self, request):
        busca = request.query_params.get('busca', '').strip()

        if len(busca) < 3:
            return Response([])

        digitos = ''.join(filtro for filtro in busca if filtro.isdigit())

        consulta = Q(nome_completo__icontains=busca) | Q(email__icontains=busca)
        if digitos:
            consulta |= Q(cpf__startswith=digitos) | Q(matricula__startswith=digitos)

        usuarios = Usuario.objects.filter(
            consulta, deleted_at__isnull=True,
        ).order_by('nome_completo')[:15]

        return Response(UsuarioResumoSerializer(usuarios, many=True).data)


class PreCadastroView(APIView):
    """
    POST /api/auth/pre-cadastro/

    Cadastro institucional feito pela coordenacao.

    Se o CPF ja existir, a pessoa nao e recriada: apenas atualizamos matricula
    e nome, e seguimos para o vinculo. E o caso comum do monitor, que ja e
    aluno da plataforma.
    """

    permission_classes = [IsAdminOrSuperuser]

    @extend_schema(
        request=PreCadastroSerializer,
        responses={201: dict},
        tags=['Autenticacao'],
        summary='Pre-cadastrar pessoa e vincular a disciplina',
    )
    def post(self, request):
        from forum.models import Disciplina, PermissaoDisciplina

        serializer = PreCadastroSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dados = serializer.validated_data

        with transaction.atomic():
            usuario = Usuario.objects.filter(cpf=dados['cpf']).first()
            criado = usuario is None

            if criado:
                usuario = Usuario(
                    cpf=dados['cpf'],
                    email=dados['email'].lower().strip(),
                    nome_completo=dados['nome_completo'],
                    matricula=dados.get('matricula', ''),
                    ativo=False,
                )
                # Sem senha utilizavel: a pessoa define a dela ao ativar.
                usuario.set_unusable_password()
                usuario.save()
            else:
                usuario.nome_completo = dados['nome_completo']
                if dados.get('matricula'):
                    usuario.matricula = dados['matricula']
                usuario.save(update_fields=['nome_completo', 'matricula'])

            vinculo = None
            if dados.get('disciplina'):
                disciplina = get_object_or_404(Disciplina, id=dados['disciplina'])
                vinculo, _ = PermissaoDisciplina.objects.update_or_create(
                    usuario=usuario,
                    disciplina=disciplina,
                    defaults={'papel': dados['papel'], 'ativo': True},
                )

            registrar_acao(
                acao='permissao_disciplina_alterada' if vinculo else 'registro',
                objeto_afetado=usuario,
                descricao=(
                    f'{"Pre-cadastro" if criado else "Atualizacao"} de '
                    f'{usuario.nome_completo} pela coordenacao'
                    + (f', como {dados["papel"]} em {vinculo.disciplina.codigo}.'
                       if vinculo else '.')
                ),
            )

        return Response(
            {
                'detail': (
                    'Pessoa cadastrada. Ela ativa a conta no primeiro acesso, '
                    'pelo mesmo codigo enviado por email aos demais usuarios.'
                    if criado else
                    'Pessoa ja cadastrada na plataforma. Vinculo atualizado.'
                ),
                'criado': criado,
                'usuario': UsuarioResumoSerializer(usuario).data,
            },
            status=status.HTTP_201_CREATED if criado else status.HTTP_200_OK,
        )


class RefreshView(TokenRefreshView):
    """
    POST /api/auth/refresh/

    Renova o token de acesso e invalida o refresh apresentado, que passa a
    constar na lista mantida no Redis.
    """

    serializer_class = RefreshComListaRedisSerializer


class LogoutView(APIView):
    """
    POST /api/auth/logout/

    Encerra a sessao invalidando o refresh token informado.

    Nao ha como revogar um token de acesso ja emitido, porque ele e validado
    apenas pela assinatura. O que o logout garante e que nenhum acesso novo
    sera emitido a partir daquela sessao, e o acesso em circulacao expira em
    ate uma hora.
    """

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        request=LogoutSerializer,
        responses={205: dict},
        tags=['Autenticacao'],
        summary='Encerrar sessao',
    )
    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            token = RefreshToken(serializer.validated_data['refresh'])
        except TokenError:
            return Response(
                {'detail': 'Refresh token invalido ou ja expirado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        invalidar(token)

        return Response(
            {'detail': 'Sessao encerrada.'},
            status=status.HTTP_205_RESET_CONTENT,
        )


class MeView(APIView):
    """
    GET   /api/auth/me/   dados do usuario autenticado
    PATCH /api/auth/me/   altera os campos que a propria pessoa controla

    Dados do usuario autenticado, incluindo os papeis que ele exerce.

    Os papeis vao juntos de proposito. A interface precisa saber, logo no
    carregamento, se deve exibir a area de moderacao ou as acoes de
    coordenacao, e buscar isso em uma chamada separada por tela produziria
    um piscar de itens aparecendo e sumindo. A permissao continua sendo
    verificada no backend a cada requisicao; isto aqui e apresentacao.
    """

    permission_classes = [permissions.IsAuthenticated]
    # A foto sobe por multipart; o restante do formulario continua chegando
    # como JSON quando nao ha arquivo.
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @extend_schema(
        summary='Dados do usuario autenticado',
        responses={200: dict},
        tags=['Autenticacao'],
    )
    def get(self, request):
        from forum.models import PermissaoDisciplina

        u = request.user

        vinculos = list(
            PermissaoDisciplina.objects.filter(usuario=u, ativo=True)
            .select_related('disciplina', 'disciplina__curso')
        )

        papeis_disciplina = [
            {
                'disciplina_id': str(v.disciplina_id),
                'disciplina_codigo': v.disciplina.codigo,
                'disciplina_nome': v.disciplina.nome,
                'papel': v.papel,
            }
            for v in vinculos
        ]

        papeis_globais = list(
            u.roles_globais.values_list('role', flat=True)
        )

        e_coordenacao = bool(u.is_admin or u.is_superuser)
        e_monitor = any(v.papel == 'monitor' for v in vinculos)
        e_professor = any(v.papel == 'professor' for v in vinculos)
        e_organizacao = 'ong' in papeis_globais

        # Curso e periodo, derivados das disciplinas em que a pessoa esta
        # matriculada como aluno. Nao guardamos esses dados no cadastro de
        # proposito: matricula e periodo mudam a cada semestre, e um campo
        # copiado fica desatualizado no dia seguinte. O vinculo com a
        # disciplina, que ja existe e e mantido pela coordenacao, e a fonte
        # verdadeira.
        #
        # O periodo e o maior entre as disciplinas cursadas, e nao a media:
        # quem esta pegando materia de terceiro e de quinto esta no quinto,
        # mesmo carregando pendencia de tras.
        matriculas = [v for v in vinculos if v.papel == 'aluno']
        cursos = {
            v.disciplina.curso for v in matriculas if v.disciplina.curso_id
        }
        periodos = [
            v.disciplina.periodo_sugerido
            for v in matriculas
            if v.disciplina.periodo_sugerido
        ]

        # Mais de um curso significa que a pessoa cursa disciplina fora do
        # proprio curso, o que acontece com optativa. Nesse caso nao ha um
        # curso unico a declarar, e preferimos nao declarar nenhum a errar.
        curso = cursos.pop() if len(cursos) == 1 else None

        return Response({
            'id': str(u.id),
            'nome_completo': u.nome_completo,
            'cpf': u.cpf,
            'matricula': u.matricula,
            'email': u.email,
            'is_admin': u.is_admin,
            'bio': u.bio or '',
            # A foto enviada tem preferencia sobre o endereco externo: quem
            # subiu a imagem pela plataforma fez isso depois.
            'avatar_url': (
                request.build_absolute_uri(u.foto.url) if u.foto
                else (u.avatar_url or '')
            ),

            'curso_nome': curso.nome if curso else '',
            'curso_codigo': curso.codigo if curso else '',
            'periodo_atual': max(periodos) if periodos else None,

            'genero': u.genero,
            'nome_responsavel': u.nome_responsavel,
            'cargo_responsavel': u.cargo_responsavel,
            'papeis_globais': papeis_globais,
            'papeis_disciplina': papeis_disciplina,

            # Atalhos usados pela interface para decidir o que exibir.
            'e_coordenacao': e_coordenacao,
            'e_monitor': e_monitor,
            'e_professor': e_professor,
            'e_organizacao': e_organizacao,
            'pode_moderar': e_coordenacao or e_monitor or e_professor,

            'rotulo_perfil': self._rotular(
                u.genero, e_coordenacao, e_professor, e_monitor, e_organizacao
            ),
        })

    # Campos que a propria pessoa altera. Lista fechada de proposito: nome,
    # CPF e matricula vem do vinculo institucional e nao se editam por aqui,
    # senao o certificado emitido deixaria de corresponder ao registro
    # academico. Papeis e permissoes tambem ficam de fora — quem define quem
    # leciona o que e a coordenacao, nao o interessado.
    CAMPOS_EDITAVEIS = ('bio', 'genero', 'data_nascimento', 'foto')

    # A organizacao parceira assina o certificado que emite, entao precisa
    # manter esses dois campos e a imagem da assinatura.
    CAMPOS_DA_ORGANIZACAO = ('nome_responsavel', 'cargo_responsavel', 'assinatura')

    @extend_schema(
        summary='Atualiza os dados editaveis do proprio perfil',
        request=None,
        responses={200: dict},
        tags=['Autenticacao'],
    )
    def patch(self, request):
        usuario = request.user

        permitidos = list(self.CAMPOS_EDITAVEIS)

        if usuario.roles_globais.filter(role='ong').exists():
            permitidos += list(self.CAMPOS_DA_ORGANIZACAO)

        alterados = []

        for campo in permitidos:
            if campo in request.FILES:
                setattr(usuario, campo, request.FILES[campo])
                alterados.append(campo)
            elif campo in request.data:
                valor = request.data[campo]

                # Campo de data em branco chega como string vazia do formulario
                # e o banco espera nulo.
                if campo == 'data_nascimento' and valor == '':
                    valor = None

                setattr(usuario, campo, valor)
                alterados.append(campo)

        if not alterados:
            return Response(
                {'detail': 'Nenhum campo editável foi enviado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        usuario.save(update_fields=alterados)

        registrar_acao(
            acao='perfil_atualizado',
            objeto_afetado=usuario,
            descricao=f'Campos alterados: {", ".join(alterados)}.',
        )

        return self.get(request)

    @staticmethod
    def _rotular(genero, coordenacao, professor, monitor, organizacao):
        """
        Nome do perfil, flexionado quando a pessoa informou o genero.

        A ordem importa: quem coordena tambem pode lecionar, e o rotulo deve
        mostrar a atribuicao de maior alcance. Quem nao informou o genero
        recebe a forma masculina, que e a nao marcada em portugues, ou uma
        palavra neutra quando existe, como no caso da organizacao.
        """
        def flexionar(masculino, feminino):
            return feminino if genero == 'f' else masculino

        if organizacao:
            return 'Organização parceira'
        if coordenacao:
            return flexionar('Coordenador', 'Coordenadora')
        if professor:
            return flexionar('Professor', 'Professora')

        # O monitor nao deixa de ser estudante: ele cursa suas proprias
        # materias e exerce monitoria em uma ou outra. O rotulo duplo evita
        # que ele se veja como algo que nao e.
        if monitor:
            return flexionar('Aluno/Monitor', 'Aluna/Monitora')

        return flexionar('Estudante', 'Estudante')
