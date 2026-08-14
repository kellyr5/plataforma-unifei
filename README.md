# Plataforma UNIFEI - Forum Academico e Voluntariado

Plataforma web que integra um forum academico organizado por disciplina com um sistema de voluntariado universitario, desenvolvida como Trabalho de Conclusao de Curso (TCC) do curso de Ciencia da Computacao da Universidade Federal de Itajuba (UNIFEI).

## Sobre o Projeto

A plataforma centraliza tres frentes da vida academica hoje subutilizadas ou inexistentes nos sistemas oficiais da universidade: a comunicacao assincrona entre alunos, monitores e professores em torno de cada disciplina; a organizacao dos trabalhos em grupo, com conversa privada por equipe e um canal para levar duvidas a quem ensina; e o cadastro estruturado de oportunidades de voluntariado oferecidas por organizacoes parceiras, com emissao automatica de certificado e validacao publica.

A interface muda conforme o papel de quem entra. Coordenacao acompanha o curso inteiro, professor abre no que precisa de resposta, monitor acumula as duas condicoes por disciplina, estudante ve apenas as materias em que esta matriculado, e organizacao parceira nao participa do forum: publica vagas e emite certificados.

## Stack Tecnologica

### Backend

- **Python 3.10+**
- **Django 5.2** com **Django REST Framework**
- **Django Channels + Daphne** (ASGI) para notificacoes em tempo real
- **PostgreSQL** como banco de dados relacional, com **pgvector** no indice da busca semantica
- **Redis** para a camada de canais do WebSocket e para a lista de refresh tokens invalidados
- **SimpleJWT** para autenticacao, com rotacao de refresh token
- **drf-spectacular** para a documentacao OpenAPI
- **WeasyPrint** para geracao dos certificados em PDF
- **sentence-transformers** para os embeddings da busca semantica, executados localmente e opcionais

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
├── forum/                  # Curso, Disciplina, Post, Voto, Arquivo, moderacao
├── colaboracao/            # Trabalho, GrupoTrabalho, Conversa, chat, pedido de ajuda
├── busca/                  # Indice semantico do forum (opcional)
├── voluntariado/           # Oportunidade, Inscricao, Certificado
├── notificacoes/           # Notificacao, consumer e rotas WebSocket
├── auditoria/              # AuditLog e middleware de contexto
├── frontend/               # Aplicacao React
├── manage.py
├── requirements.txt
└── requirements-ia.txt     # Dependencias da busca semantica, instaladas a parte
```

Cada app segue o mesmo padrao: `models.py` para a modelagem, `services.py` para a regra de negocio que nao cabe na view, `signals.py` para reacoes a eventos e `api/` para serializers, views e rotas.

## Modelagem do Banco

A modelagem segue a Terceira Forma Normal (3FN), distribuida em seis modulos:

- **Autenticacao:** Usuario, CodigoAtivacao, RoleGlobal
- **Forum:** Curso, Disciplina, PermissaoDisciplina, Post, HistoricoEdicao, Voto, ReacaoPersiste, Arquivo, AlertaConteudo
- **Colaboracao:** Trabalho, GrupoTrabalho, MembroGrupo, Conversa, ParticipanteConversa, MensagemChat, SolicitacaoAjuda
- **Voluntariado:** Oportunidade, InscricaoVoluntariado, Certificado
- **Notificacoes e Auditoria:** Notificacao, AuditLog
- **Busca:** IndicePost

Decisoes de projeto: chaves primarias em UUID, soft delete via campo `deleted_at`, RBAC desacoplado da tabela Usuario, registros de auditoria nunca deletados, e refresh tokens invalidados no Redis em vez do banco relacional, aproveitando o TTL para descartar o registro assim que o token expiraria.

A matriz curricular vem do Projeto Pedagogico do Curso, importada por comando:

```bash
python manage.py importar_matriz_ppc docs/ppc-cco.txt \
    --curso CCO --nome "Ciencia da Computacao" --ano 2026
```

Disciplina carrega periodo sugerido, carga horaria, ementa, pre-requisitos e co-requisitos. A oferta segue a paridade do periodo: disciplinas de periodo impar sao ofertadas no primeiro semestre e as de periodo par, no segundo.

O curso tem 32 disciplinas obrigatorias: as 30 da Tabela 4.2 do PPC, mais TCC1 e TCC2, descritas fora dela.

**Divergencia interna do PPC.** O documento declara o periodo de cada disciplina em dois lugares, e eles discordam em quatro casos — XPAD01, CTCO03, CTCO05 e CTCO06. A plataforma segue o ementario da secao 5, que organiza as disciplinas em grades por periodo com a carga somada ao fim de cada uma, e e o desenho da oferta semestral que a coordenacao efetivamente monta; a Tabela 4.2 e um indice por area de conhecimento, onde o periodo e informacao secundaria. A escolha importa porque a oferta segue a paridade: a mesma disciplina em periodo par ou impar muda de semestre. O script `docs/corrigir_periodos.py` confere as duas fontes sem alterar nada.

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

### Perfis de demonstracao

```bash
python manage.py criar_perfis_demo          # idempotente
python manage.py criar_perfis_demo --reset  # zera vinculos e publicacoes antes
```

Cria uma conta de cada perfil, com conteudo suficiente para as telas dizerem alguma coisa: a fila de moderacao precisa de denuncia, o painel de andamento precisa de participacao. Senha comum a todas: `Demo2026.`

| Perfil | CPF | Nome |
| --- | --- | --- |
| Coordenacao | 10000000001 | Ana Beatriz Ferreira |
| Professor | 10000000002 | Rafael Andrade |
| Monitora | 10000000003 | Carla Nogueira |
| Aluno | 10000000004 | Diego Martins |
| Organizacao | 10000000005 | Instituto Semear |
| Aluna | 10000000006 | Larissa Campos |

Os dois estudantes existem para permitir avaliar grupo, conversa e pedido de ajuda: com uma conta so, a tela nunca mostra o outro lado. Nao use em producao — as senhas sao conhecidas e as contas nascem ativas, pulando a verificacao por codigo.

### Semestre completo de demonstracao

```bash
python manage.py criar_perfis_demo --reset
python manage.py popular_demonstracao
```

O segundo comando constroi um semestre em volta dos cinco perfis: 28 estudantes matriculados em quatro a seis disciplinas cada, oito docentes, tres monitores escolhidos entre os proprios alunos, discussao espalhada pelas disciplinas ofertadas e cinco acoes de voluntariado de tres organizacoes, com inscricoes em todos os estados e certificados emitidos.

O ponto do comando nao e o volume, e a variacao. As disciplinas recebem ritmos diferentes de proposito — resposta em horas, resposta em dias, movimento moderado e silencio — e uma em cada cinco fica sem docente alocado. Sem esse contraste, o painel da coordenacao exibe uma linha com numero e as demais zeradas, e o indicador de tempo medio de resposta nao descreve nada: media sobre um caso nao e media. O sorteio usa semente fixa, entao rodar duas vezes produz o mesmo banco.

As capas das oportunidades sao desenhadas por codigo, em degrade do azul institucional, em vez de baixadas. A escolha evita a questao de licenca de uso e a dependencia de rede para reproduzir o ambiente.

### Testes

```bash
python manage.py test
```

A suite nao exige Redis: os testes de WebSocket usam a camada de canais em memoria e os de token usam cache em memoria. Tambem nao exige o modelo de embeddings: com a busca semantica desligada, os testes cobrem o caminho textual e verificam que a ausencia da biblioteca nao quebra o forum.

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
| `/api/colaboracao/` | Trabalhos em grupo, grupos, conversas, mensagens e pedidos de ajuda |
| `/api/voluntariado/` | Oportunidades, inscricoes e certificados, com validacao publica por codigo |
| `/api/busca/` | Busca no forum, por significado ou por termo |
| `/api/notificacoes/` | Notificacoes do usuario |
| `/api/auditoria/` | Registros de auditoria |

### WebSocket

```
ws://localhost:8000/ws/notificacoes/?token=<access_token>
ws://localhost:8000/ws/conversas/<uuid_da_conversa>/?token=<access_token>
```

O token vai na query string porque o navegador nao permite cabecalhos personalizados na abertura de um WebSocket. Conexoes sem token valido sao recusadas com o codigo 4001; quem nao participa da conversa, com o codigo 4003.

Pelo canal da conversa trafega apenas texto. Anexos e audio sobem por HTTP e sao retransmitidos ao canal depois de gravados, porque arquivo em base64 sobre WebSocket segura a conexao de todos os participantes enquanto e transferido.

## Decisoes de Implementacao

**Votos sem downvote.** O voto negativo foi substituido pela reacao "duvida persiste", aplicavel apenas em respostas. A sinalizacao continua existindo, sem o efeito desencorajador documentado na literatura sobre comunidades online.

**Moderacao descentralizada.** Monitores e professores moderam as denuncias das disciplinas em que atuam, porque tem contexto para julgar o conteudo. A fila tem estado de "assumido" para evitar que dois moderadores trabalhem no mesmo caso.

**Sem gamificacao.** O sistema de reputacao e ranking foi removido do projeto. Pontuacao publica desloca o incentivo de ajudar para o de pontuar, e num forum de disciplina, onde as mesmas pessoas convivem o semestre inteiro, esse deslocamento aparece rapido. O reconhecimento agora e apenas a marcacao de melhor resposta, que serve a quem le depois.

**Analise da denuncia em tela propria.** A fila de moderacao faz a triagem; a decisao acontece em pagina separada, com o conteudo denunciado por inteiro e uma justificativa obrigatoria que chega ao autor. Decidir a partir do titulo e do motivo, sem ler o que foi escrito, era o que a lista permitia.

**Acessibilidade.** A plataforma atende uma universidade publica federal, e acessibilidade digital nesse contexto e obrigacao legal — Decreto 5.296/2004 e Lei Brasileira de Inclusao — nao recurso adicional. O que esta implementado:

- `lang="pt-BR"` no elemento raiz. Com o valor `en` que vinha do gerador do projeto, o leitor de tela pronunciava o portugues com fonetica inglesa e a interface ficava incompreensivel para quem depende de audio.
- Indicador de foco em todo elemento focavel, por `:focus-visible`, que aparece na navegacao por teclado e nao no clique de mouse.
- Atalho "Pular para o conteudo" como primeiro elemento focavel. Sem ele, quem usa teclado percorre os treze itens da barra lateral a cada troca de pagina antes de alcancar o que veio ler.
- `aria-label` nos controles que so tem icone, e `aria-current="page"` no item de navegacao ativo — o destaque visual do item ativo era informacao que so existia para quem enxerga.
- `aria-hidden` nos numeros que o rotulo do proprio botao ja anuncia, para o leitor nao repetir a contagem.
- Respeito a `prefers-reduced-motion`: quem sinalizou preferencia por menos movimento no sistema operacional recebe a interface sem animacao.
- Contraste verificado nos dois temas. O verde-oliva institucional, por exemplo, tem duas variantes: a original para preenchimento e uma escurecida para texto, porque a original da 2,3:1 sobre branco e nao atende ao minimo.

**Administrar da visibilidade, nao participacao.** A coordenacao enxerga o curso inteiro — todas as disciplinas, todos os trabalhos, toda a fila de moderacao — porque responde por ele. Mas nao esta matriculada em nenhuma turma e nao leciona, e por isso nao entra em grupo de trabalho, nao publica no forum e nao organiza equipes. O sistema separa as duas ideias em predicados distintos: `pode_moderar_disciplina`, que o administrador satisfaz, e `leciona_disciplina`, que exige vinculo de professor ou monitor. Dividir turma, sortear grupo e responder duvida de equipe pedem conhecimento do enunciado, dos alunos e do momento do conteudo — atribuicoes de quem da a aula naquele semestre.

A interface acompanha a regra: quem nao tem vinculo com disciplina nao ve as abas de Forum, Trabalhos e Pedidos de ajuda, porque toda acao disponivel nelas terminaria em recusa do servidor.

**Privacidade da conversa de grupo.** O professor nao entra no chat das equipes, mesmo sendo responsavel pela disciplina. O que chega a ele e apenas a mensagem que o grupo marcou como duvida, com a descricao que escreveu. A decisao segue o modelo do Piazza e tem uma razao pratica: grupo que se sente observado migra para aplicativos externos, e a plataforma perde justamente o registro que pretende manter.

**Certificados imutaveis.** Os dados sao congelados no momento da emissao, preservando a validade do documento mesmo que a oportunidade ou o perfil mudem depois.

**Busca semantica opcional.** A busca do forum compara o significado da pergunta com o das publicacoes ja escritas, o que liga "meu laco executa uma vez a mais" a "erro de off-by-one" — duvidas iguais sem termo em comum. Os embeddings sao gerados localmente: o texto e material academico de estudantes identificaveis, e enviar isso a um servico externo criaria uma questao de tratamento de dados desnecessaria ao projeto. Sem a biblioteca instalada, a busca responde por correspondencia de termos e nenhuma outra tela muda.

### Ativar a busca semantica

```bash
pip install -r requirements-ia.txt
psql -c "CREATE EXTENSION IF NOT EXISTS vector;"   # uma unica vez, como superusuario
echo "BUSCA_SEMANTICA_ATIVA=True" >> .env
python manage.py migrate
python manage.py indexar_forum
```

O primeiro carregamento baixa o modelo (cerca de 470 MB) e fica em cache local. A indexacao roda depois do commit da publicacao, para nao prender a transacao do banco durante a geracao do vetor.

## Autoria

Trabalho desenvolvido por **Kelly Reis** sob orientacao do **Prof. Bruno Guazzelli Batista**, no ambito do TCC do curso de Bacharelado em Ciencia da Computacao da Universidade Federal de Itajuba (UNIFEI).

## Licenca

Projeto academico. Todos os direitos reservados.
