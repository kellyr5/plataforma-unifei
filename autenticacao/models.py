import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin


class UsuarioManager(BaseUserManager):
    """Gerenciador customizado para login por CPF."""

    def create_user(self, cpf, email, nome_completo, password=None):
        if not cpf:
            raise ValueError('O CPF é obrigatório')
        if not email:
            raise ValueError('O email é obrigatório')

        email = self.normalize_email(email)
        cpf = cpf.replace('.', '').replace('-', '').strip()

        usuario = self.model(
            cpf=cpf,
            email=email,
            nome_completo=nome_completo,
        )
        usuario.set_password(password)
        usuario.save(using=self._db)
        return usuario

    def create_superuser(self, cpf, email, nome_completo, password=None):
        usuario = self.create_user(cpf, email, nome_completo, password)
        usuario.is_admin = True
        usuario.is_superuser = True
        usuario.ativo = True
        usuario.save(using=self._db)
        return usuario


class Usuario(AbstractBaseUser, PermissionsMixin):
    """Tabela principal de usuarios do sistema."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nome_completo = models.CharField(max_length=255)
    cpf = models.CharField(max_length=11, unique=True, db_index=True)
    matricula = models.CharField(
        max_length=20,
        blank=True,
        default='',
        db_index=True,
        help_text='Matrícula institucional, usada no pré-cadastro pela coordenação',
    )
    email = models.EmailField(max_length=150, unique=True)
    GENERO_CHOICES = [
        ('f', 'Feminino'),
        ('m', 'Masculino'),
        ('n', 'Prefiro não informar'),
    ]

    genero = models.CharField(
        max_length=1,
        choices=GENERO_CHOICES,
        default='n',
        help_text='Usado apenas para flexionar o nome do perfil na interface',
    )

    # Curso sob responsabilidade de quem coordena.
    #
    # Hoje a plataforma atende um curso e quem e admin enxerga tudo. Com dois
    # cursos, cada coordenacao precisa ver apenas o seu, e quem cadastra
    # cursos e nomeia coordenadores passa a ser o superusuario, que nao tem
    # tela propria. Registrar o vinculo agora evita reescrever as consultas
    # depois, e custa um campo.
    curso_coordenado = models.ForeignKey(
        'forum.Curso',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='coordenadores',
        help_text='Preenchido apenas para quem coordena um curso',
    )

    ativo = models.BooleanField(default=False)
    bio = models.TextField(blank=True, default='')
    data_nascimento = models.DateField(null=True, blank=True)
    avatar_url = models.CharField(max_length=255, blank=True, default='')

    # Imagem enviada pela propria pessoa. Para a organizacao parceira e o
    # logotipo: quem procura oportunidade reconhece a instituicao pela marca
    # antes de ler o nome, e uma lista de oportunidades sem identificacao
    # visual obriga a ler tudo para saber quem esta oferecendo o que.
    foto = models.ImageField(
        upload_to='perfis/%Y/%m/',
        null=True,
        blank=True,
        help_text='Foto de perfil, ou logotipo no caso da organizacao parceira',
    )

    # Dados usados na assinatura do certificado emitido pela organizacao.
    nome_responsavel = models.CharField(max_length=255, blank=True, default='')
    cargo_responsavel = models.CharField(max_length=120, blank=True, default='')
    assinatura = models.ImageField(
        upload_to='assinaturas/',
        null=True,
        blank=True,
        help_text='Imagem da assinatura do responsavel, usada no certificado',
    )
    reputacao = models.IntegerField(default=0)
    ultimo_acesso = models.DateTimeField(null=True, blank=True)
    is_admin = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = UsuarioManager()

    USERNAME_FIELD = 'cpf'
    REQUIRED_FIELDS = ['email', 'nome_completo']

    class Meta:
        db_table = 'usuario'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.nome_completo} ({self.cpf})'

    @property
    def is_staff(self):
        return self.is_admin

    @property
    def is_active(self):
        return self.ativo

    def save(self, *args, **kwargs):
        self.cpf = self.cpf.replace('.', '').replace('-', '').strip()
        super().save(*args, **kwargs)
        
class CodigoAtivacao(models.Model):
    """Codigos para ativacao de conta e recuperacao de senha."""

    TIPO_CHOICES = [
        ('ativacao', 'Ativação'),
        ('reset_senha', 'Recuperação de Senha'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='codigos')
    codigo = models.CharField(max_length=128, help_text='Hash bcrypt do codigo de ativacao')
    tipo = models.CharField(max_length=15, choices=TIPO_CHOICES)
    tentativas = models.IntegerField(default=0)
    data_expiracao = models.DateTimeField()
    utilizado = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'codigo_ativacao'

    def __str__(self):
        return f'{self.tipo} - {self.usuario.cpf}'
    
class RoleGlobal(models.Model):
    """Papeis globais que nao dependem de disciplina."""

    ROLE_CHOICES = [
        ('admin', 'Administrador'),
        ('ong', 'Organização'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='roles_globais')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'role_global'
        unique_together = ['usuario', 'role']

    def __str__(self):
        return f'{self.usuario.cpf} - {self.role}'