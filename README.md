# Plataforma UNIFEI - Forum Academico e Voluntariado

Plataforma web que integra um forum academico organizado por disciplina com um sistema de voluntariado universitario, desenvolvida como Trabalho de Conclusao de Curso (TCC) do curso de Ciencia da Computacao da Universidade Federal de Itajuba (UNIFEI).

## Sobre o Projeto

A plataforma centraliza duas frentes da vida academica hoje subutilizadas ou inexistentes nos sistemas oficiais da universidade: a comunicacao assincrona entre alunos, monitores e professores em torno de cada disciplina, e o cadastro estruturado de oportunidades de voluntariado oferecidas por organizacoes parceiras, com emissao automatica de certificado e validacao publica.

## Stack Tecnologica

### Backend

- **Python 3.10+**
- **Django 5.2** com **Django REST Framework**
- **Django Channels + Daphne** (ASGI) para notificacoes em tempo real
- **PostgreSQL** como banco de dados relacional
- **Redis** para a camada de canais do WebSocket e para a lista de refresh tokens invalidados
- **SimpleJWT** para autenticacao, com rotacao de refresh token
- **drf-spectacular** para a documentacao OpenAPI
- **WeasyPrint** para geracao dos certificados em PDF

### Frontend

- **React.js** com **TypeScript**
- **TailwindCSS v4**
- **Vite** como bundler, com proxy de `/api` e `/ws` para o backend

## Estrutura do Projeto

```
plataforma-unifei/
├── config/                 # Configuracoes do projeto
│   ├── settings.py
│   ├── urls.py             # Rotas HTTP
│   ├── asgi.py             # Roteamento HTTP + WebSocket
│   ├── ws_auth.py          # Autenticacao JWT nas conexoes WebSocket
│   ├── pagination.py       # Paginacao padrao da API
│   ├── permissions/        # Permissoes compartilhadas entre apps
│   └── testing.py          # Fabricas usadas pelos testes
├── autenticacao/           # Usuario, CodigoAtivacao, RoleGlobal
│   ├── api/
│   └── tokens.py           # Lista de refresh tokens invalidados (Redis)
├── forum/                  # Disciplina, Post, Voto, Arquivo, moderacao
├── voluntariado/           # Oportunidade, Inscricao, Certificado
├── reputacao/              # Reputacao por disciplina e ranking semestral
├── notificacoes/           # Notificacao, consumer e rotas WebSocket
├── auditoria/              # AuditLog e middleware de contexto
├── frontend/               # Aplicacao React
├── manage.py
└── requirements.txt
```

Cada app segue o mesmo padrao: `models.py` para a modelagem, `services.py` para a regra de negocio que nao cabe na view, `signals.py` para reacoes a eventos e `api/` para serializers, views e rotas.

## Modelagem do Banco

A modelagem segue a Terceira Forma Normal (3FN), totalizando 17 tabelas distribuidas em cinco modulos:

- **Autenticacao:** Usuario, CodigoAtivacao, PermissaoDisciplina, RoleGlobal
- **Forum:** Disciplina, Post, HistoricoEdicao, Voto, ReacaoPersiste, Arquivo, AlertaConteudo
- **Voluntariado:** Oportunidade, InscricaoVoluntariado, Certificado
- **Perfil e Reputacao:** UsuarioDisciplinaReputacao, RankingSemestral
- **Notificacoes e Auditoria:** Notificacao, AuditLog

Decisoes de projeto: chaves primarias em UUID, soft delete via campo `deleted_at`, RBAC desacoplado da tabela Usuario, registros de auditoria nunca deletados, e refresh tokens invalidados no Redis em vez do banco relacional, aproveitando o TTL para descartar o registro assim que o token expiraria.

## Como Rodar Localmente

### Pre-requisitos

- Python 3.10 ou superior
- PostgreSQL 14 ou superior
- Redis 6 ou superior
- Node.js 22 (frontend)

### Backend

```bash
git clone https://github.com/kellyr5/plataforma-unifei.git
cd plataforma-unifei

python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env      # preencher com as credenciais locais

sudo service postgresql start
sudo service redis-server start

python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 0.0.0.0:8000
```

O servidor sobe em ASGI/Daphne, atendendo HTTP e WebSocket na mesma porta.

### Frontend

```bash
cd frontend
nvm use 22
npm install
npm run dev
```

Disponivel em `http://localhost:5173`, com proxy de `/api` e `/ws` para a porta 8000.

### Testes

```bash
python manage.py test
```

A suite nao exige Redis: os testes de WebSocket usam a camada de canais em memoria e os de token usam cache em memoria.

## API

Documentacao interativa em `/api/docs/` (Swagger) e `/api/redoc/`. O contrato OpenAPI fica em `schema.yml`, regenerado com:

```bash
python manage.py spectacular --file schema.yml --validate
```

### Paginacao

Todas as listagens sao paginadas, com 20 itens por pagina e teto de 100 via `?page_size=`. O formato da resposta e `{count, next, previous, results}`.

### Grupos de endpoints

| Prefixo | Conteudo |
| --- | --- |
| `/api/auth/` | Registro, ativacao por codigo, login, refresh, logout, dados do usuario |
| `/api/forum/` | Disciplinas, posts, votos, reacoes, anexos, permissoes e fila de moderacao |
| `/api/voluntariado/` | Oportunidades, inscricoes e certificados, com validacao publica por codigo |
| `/api/reputacao/` | Reputacao por disciplina, ranking ao vivo e rankings semestrais |
| `/api/notificacoes/` | Notificacoes do usuario |
| `/api/auditoria/` | Registros de auditoria |

### WebSocket

```
ws://localhost:8000/ws/notificacoes/?token=<access_token>
```

O token vai na query string porque o navegador nao permite cabecalhos personalizados na abertura de um WebSocket. Conexoes sem token valido sao recusadas com o codigo 4001.

## Decisoes de Implementacao

**Votos sem downvote.** O voto negativo foi substituido pela reacao "duvida persiste", aplicavel apenas em respostas. A sinalizacao continua existindo, sem o efeito desencorajador documentado na literatura sobre comunidades online.

**Moderacao descentralizada.** Monitores e professores moderam as denuncias das disciplinas em que atuam, porque tem contexto para julgar o conteudo. A fila tem estado de "assumido" para evitar que dois moderadores trabalhem no mesmo caso.

**Reputacao por disciplina.** A pontuacao segue o modelo do Stack Overflow, calculada por disciplina e nao globalmente. O recalculo e hibrido: incremental por signals no uso corrente, total pelo comando `python manage.py recalcular_reputacao`.

**Certificados imutaveis.** Os dados sao congelados no momento da emissao, preservando a validade do documento mesmo que a oportunidade ou o perfil mudem depois.

## Autoria

Trabalho desenvolvido por **Kelly Reis** sob orientacao do **Prof. Bruno Guazzelli Batista**, no ambito do TCC do curso de Bacharelado em Ciencia da Computacao da Universidade Federal de Itajuba (UNIFEI).

## Licenca

Projeto academico. Todos os direitos reservados.
