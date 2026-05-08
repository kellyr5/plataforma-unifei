# Plataforma UNIFEI - Forum Academico e Voluntariado

Plataforma web que integra um forum academico organizado por disciplina com um sistema de voluntariado universitario, desenvolvida como Trabalho de Conclusao de Curso (TCC) do curso de Ciencia da Computacao da Universidade Federal de Itajuba (UNIFEI).

## Sobre o Projeto

A plataforma tem como objetivo centralizar duas frentes da vida academica que hoje sao subutilizadas ou inexistentes nos sistemas oficiais da universidade: a comunicacao assincrona entre alunos, monitores e professores em torno de cada disciplina, e o cadastro estruturado de oportunidades de voluntariado oferecidas por organizacoes parceiras.

## Stack Tecnologica

### Backend
- **Python 3.10+**
- **Django 5.2** com **Django REST Framework**
- **PostgreSQL** como banco de dados relacional
- **Redis** para armazenamento de tokens JWT (planejado)
- **WebSockets** para notificacoes em tempo real (planejado)

### Frontend
- **React.js** com **TypeScript**
- **TailwindCSS** para estilizacao

## Estrutura do Projeto
plataforma-unifei/
├── config/              # Configuracoes do Django (settings, urls, wsgi)
├── autenticacao/        # App de autenticacao (Usuario, CodigoAtivacao, RoleGlobal)
│   ├── api/             # Camada de API (serializers, views, urls)
│   └── models.py
├── forum/               # App do forum academico
│   ├── api/
│   └── models.py
├── manage.py
├── requirements.txt
└── .gitignore

## Modelagem do Banco

A modelagem segue a Terceira Forma Normal (3FN), totalizando 17 tabelas distribuidas em cinco modulos:

- **Autenticacao:** Usuario, CodigoAtivacao, PermissaoDisciplina, RoleGlobal
- **Forum:** Disciplina, Post, HistoricoEdicao, Voto, Arquivo, AlertaConteudo
- **Voluntariado:** Oportunidade, InscricaoVoluntariado, Certificado
- **Perfil e Reputacao:** UsuarioDisciplinaReputacao, RankingSemestral
- **Notificacoes e Auditoria:** Notificacao, AuditLog

Decisoes de projeto: chaves primarias em UUID, soft delete via campo `deleted_at`, RBAC desacoplado da tabela Usuario, registros de auditoria nunca deletados, e tokens JWT/refresh armazenados em Redis (nao no banco relacional).

## Como Rodar Localmente

### Pre-requisitos
- Python 3.10 ou superior
- PostgreSQL 14 ou superior
- pip e virtualenv

### Instalacao

```bash
# Clonar o repositorio
git clone https://github.com/kellyr5/plataforma-unifei.git
cd plataforma-unifei

# Criar e ativar o ambiente virtual
python3 -m venv venv
source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt

# Aplicar migrations
python manage.py migrate

# Criar superusuario
python manage.py createsuperuser

# Subir o servidor
python manage.py runserver 0.0.0.0:8000
```

A aplicacao ficara disponivel em `http://localhost:8000`.

## Endpoints Disponiveis

### Forum

- `GET /api/forum/disciplinas/` - Lista todas as disciplinas
- `POST /api/forum/disciplinas/` - Cria uma nova disciplina
- `GET /api/forum/disciplinas/{id}/` - Detalha uma disciplina
- `PUT /api/forum/disciplinas/{id}/` - Atualiza uma disciplina
- `DELETE /api/forum/disciplinas/{id}/` - Remove (soft delete) uma disciplina
- `GET /api/forum/disciplinas/?search={termo}` - Busca por codigo, nome ou curso

### Admin

- `GET /admin/` - Painel administrativo do Django

## Autoria

Trabalho desenvolvido por **Kelly Reis** sob orientacao do **Prof. Bruno Guazzelli Batista**, no ambito do TCC do curso de Bacharelado em Ciencia da Computacao da Universidade Federal de Itajuba (UNIFEI), no primeiro semestre de 2026.

## Licenca

Projeto academico. Todos os direitos reservados.
