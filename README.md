# Plataforma UNIFEI

> Plataforma web que integra três frentes da vida acadêmica: fórum disciplinar, trabalhos em grupo colaborativos e voluntariado com certificação.

**Status:** Em desenvolvimento | **Deploy:** [plataforma-unifei.onrender.com](https://plataforma-unifei.onrender.com)

---

## 📋 Visão Geral

A Plataforma UNIFEI centraliza as atividades acadêmicas dispersas entre SIGAA, aplicativos de mensagem e arquivos pessoais, oferecendo:

- **Fórum Acadêmico** — Dúvidas organizadas por disciplina/período com votação, marcação de melhor resposta, moderação e busca semântica
- **Trabalhos em Grupo** — Formação flexível, conversa em tempo real com áudio/anexos, material de apoio integrado e fila de dúvidas para monitoria
- **Voluntariado com Certificado** — Ações presenciais e campanhas de doação com emissão de PDF verificável como atividade complementar

**Interface adaptativa:** Coordenação, Professor, Monitor, Estudante e Organização Parceira têm visualizações e permissões distintas.

---

## 🛠️ Stack Tecnológico

### Backend
- **Python 3.10** | **Django 5.2** | **Django REST Framework**
- **Django Channels + Daphne** — WebSocket para comunicação em tempo real
- **PostgreSQL + pgvector** — Busca semântica e embedding
- **Redis** — Cache e fila de tarefas
- **SimpleJWT** — Autenticação com lista de negação
- **WeasyPrint** — Geração de PDFs
- **sentence-transformers** — NLP para busca semântica

### Frontend
- **React + TypeScript** — Componentes tipados
- **Vite** — Build otimizado
- **TailwindCSS v4** — Estilização
- **Axios** — Cliente HTTP

### Infraestrutura
- **Docker** multiestágio
- **WhiteNoise** — Servir assets estáticos
- **django-storages** — Armazenamento em nuvem
- **Render** — Hospedagem

---

## 📁 Estrutura de Diretórios

```
plataforma-unifei/
├── backend/
│   ├── core/                 # Configuração Django
│   ├── apps/
│   │   ├── forum/           # Módulo de fórum
│   │   ├── group_work/      # Módulo de trabalhos em grupo
│   │   ├── volunteering/    # Módulo de voluntariado
│   │   ├── users/           # Gestão de usuários e roles
│   │   └── notifications/   # Sistema de notificações
│   ├── tests/               # Suite de testes automatizados
│   ├── manage.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/      # Componentes React
│   │   ├── pages/           # Páginas por role
│   │   ├── services/        # Chamadas API
│   │   ├── hooks/           # Custom hooks
│   │   └── styles/          # TailwindCSS
│   ├── vite.config.ts
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
├── README.md
└── docs/
    ├── ARQUITETURA.md       # Diagrama ER atualizado
    ├── API.md               # Documentação endpoints
    └── DESENVOLVIMENTO.md   # Guia para contribuir
```

---

## 🚀 Como Executar

### Pré-requisitos
- Docker e Docker Compose
- Node.js 18+ (se rodar frontend fora de container)
- Python 3.10+ (se rodar backend fora de container)

### Com Docker (Recomendado)

```bash
# Clone o repositório
git clone https://github.com/kellyr5/plataforma-unifei.git
cd plataforma-unifei

# Configure variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais

# Inicie os contêineres
docker-compose up -d

# Aplique migrações
docker-compose exec backend python manage.py migrate

# Crie superusuário
docker-compose exec backend python manage.py createsuperuser

# Acesse em http://localhost:3000 (frontend) e http://localhost:8000 (admin)
```

### Desenvolvimento Local

#### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # No Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py runserver
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## ✅ Funcionalidades

### Fórum Acadêmico
- ✓ Perguntas por disciplina/período
- ✓ Votação de respostas
- ✓ Marcação de melhor resposta
- ✓ Busca semântica com embedding
- ✓ Moderação por denúncia

### Trabalhos em Grupo
- ✓ Formação por escolha ou sorteio
- ✓ Chat privado em tempo real (WebSocket)
- ✓ Compartilhamento de anexos
- ✓ Material de apoio integrado
- ✓ Fila de dúvidas para monitoria/professores

### Voluntariado
- ✓ Publicação de ações presenciais
- ✓ Campanhas de doação
- ✓ Certificado PDF com código de verificação
- ✓ Integração com atividades complementares

---

## 🧪 Testes

A suite de testes cobre permissões, privacidade e regras de negócio:

```bash
cd backend
python manage.py test

# Com cobertura
coverage run --source='.' manage.py test
coverage report
```

---

## 📊 Estado Atual

| Módulo | Status | Detalhes |
|--------|--------|----------|
| Fórum | ✓ Pronto | Implementado com busca semântica |
| Trabalhos em Grupo | ✓ Pronto | WebSocket + chat em tempo real |
| Voluntariado | ✓ Pronto | Certificação automatizada |
| Testes | ✓ Pronto | Cobertura completa |
| **Pendências** | | |
| Validação UX | ⏳ Etapa final TCC | Testes com usuários reais (Seção 4.3) |
| Documentação | ⏳ Em andamento | ER atualizado (26 tabelas), artigo em conclusão |
| Branch main | ⚠️ Desatualizada | Mesclagem interrompida há 3 meses |

---

## 🔄 Atualização Urgente

**⚠️ Atenção:** A branch `main` no GitHub pode estar desatualizada. Os módulos de **Colaboração** e **Busca Semântica** podem não estar refletidos. Para ver o estado completo:

```bash
git branch -a
git checkout develop  # ou outra branch ativa
```

Recomenda-se **completar a mesclagem** e fazer push da branch principal atualizada.

---

## 📚 Documentação

- `docs/ARQUITETURA.md` — Diagrama ER atualizado, fluxos de dados
- `docs/API.md` — Endpoints REST com exemplos
- `docs/DESENVOLVIMENTO.md` — Guia de contribuição, padrões de código
- Admin Django — Em `http://localhost:8000/admin/` (superusuário)

---

## 🤝 Contribuindo

1. Crie uma branch para sua feature: `git checkout -b feature/sua-feature`
2. Commit com mensagem descritiva: `git commit -m "feat: descrição"`
3. Push e abra um Pull Request
4. Certifique-se que os testes passam: `python manage.py test`

---

## 📝 Licença

Projeto acadêmico (TCC) — Universidade Federal de Itajubá (UNIFEI)

---

## 👤 Autor

**Kelly Reis**  
Desenvolvedor Backend | Análise de Dados | Python | Django  
[LinkedIn](https://linkedin.com/in/kelly-reis-a4b0ab194) | [GitHub](https://github.com/kellyr5)
