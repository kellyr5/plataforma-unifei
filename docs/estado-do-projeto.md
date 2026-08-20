# Estado do projeto — Plataforma UNIFEI

Este arquivo existe para orientar quem entra no projeto sem ter acompanhado o
desenvolvimento. Ele resume o que está feito, o que falta e as decisões que não
são óbvias ao ler o código pela primeira vez.

**Confira sempre no código antes de afirmar qualquer coisa.** Este documento
descreve o estado numa data; o repositório descreve o estado agora. Onde os
dois discordarem, o código está certo.

Última revisão: agosto de 2026.

---

## O que é

Trabalho de Conclusão de Curso em Ciência da Computação na Universidade Federal
de Itajubá. Autora: Kelly. Orientador: Prof. Bruno Guazzelli Batista.

A plataforma reúne três coisas que hoje vivem separadas na vida acadêmica:

1. **Fórum acadêmico organizado por disciplina** — a dúvida fica ligada à
   matéria e ao período, e não perdida num grupo de mensagens.
2. **Módulo de trabalho em grupo** — formação de grupos, conversa privada da
   equipe, material de apoio preso ao enunciado e fila de pedidos de ajuda que
   chega a quem conduz a turma.
3. **Voluntariado universitário com certificação** — oportunidades publicadas
   por organizações parceiras, com emissão de certificado de participação para
   aproveitamento como atividade complementar.

O argumento central é que a dispersão do material acadêmico entre o SIGAA, os
aplicativos de mensagem e os arquivos pessoais é um problema real, e que reunir
esse material num lugar organizado por disciplina tem valor mensurável.

---

## Tecnologias

**Backend:** Django 5.2, Django REST Framework, drf-spectacular para o esquema
da API, Django Channels 4.2 com Daphne para os WebSockets, SimpleJWT com lista
de negação no Redis.

**Banco:** PostgreSQL com a extensão pgvector. Chaves primárias em UUID.
Exclusão lógica por `deleted_at` nos modelos em que apagar de verdade
destruiria histórico.

**Frontend:** React com TypeScript, TailwindCSS v4, Vite, Axios.

**Outros:** WeasyPrint para o PDF do certificado, python-magic para verificar o
tipo real dos arquivos enviados, Pillow, sentence-transformers para a busca
semântica.

---

## Organização do repositório

```
autenticacao/   Usuário, primeiro acesso, perfis, comandos de carga
forum/          Disciplina, publicação, resposta, voto, moderação, anexos
colaboracao/    Trabalho, grupo, conversa, mensagem, pedido de ajuda, acervo
voluntariado/   Oportunidade, inscrição, certificado
notificacoes/   Notificação e entrega por WebSocket
busca/          Índice vetorial e busca semântica
config/         Configurações, permissões compartilhadas, utilidades de teste
frontend/       Aplicação React
artigo/         Texto do TCC em LaTeX
deploy/         Script de inicialização em produção
docs/           Matriz curricular, roteiro de avaliação, este arquivo
```

---

## Decisões que não são óbvias no código

Estas são as que mais custaram a chegar ao formato atual. Alterar qualquer uma
delas sem entender o motivo reintroduz um defeito que já foi corrigido.

### Moderar não é lecionar

Em `config/permissions/__init__.py` existem duas funções que parecem
equivalentes e não são:

- `pode_moderar_disciplina` — o administrador passa. Vale para supervisão e
  moderação de conteúdo.
- `leciona_disciplina` — o administrador **não** passa. Vale para tudo que
  pressupõe participar da turma.

A distinção é entre supervisionar e participar. Enquanto as duas eram a mesma
função, a coordenação conseguia entrar em grupos de trabalho de disciplinas em
que não estava matriculada — e cada ação disponível na tela terminava em erro
do servidor.

O critério de exibição das abas no menu é o **vínculo com a disciplina**, e não
o papel global, porque é o vínculo que define pertencimento a uma turma.

### A conversa do grupo é privada, inclusive para o professor

É a decisão que sustenta o desenho do módulo de colaboração. Sem privacidade,
os grupos migram para aplicativos externos e o material se perde no fim do
semestre — que é exatamente o problema que a plataforma existe para resolver.

O único conteúdo do grupo que chega a quem ensina é o pedido de ajuda, e mesmo
assim recortado: apenas a mensagem que o aluno marcou e a descrição que ele
escreveu. A conversa em volta continua invisível.

### O acervo de arquivos não afrouxa permissão

`colaboracao/acervo.py` reúne arquivos de três origens — anexo de conversa,
material de trabalho e anexo de publicação — numa lista agrupada por
disciplina. Não há modelo novo nem cópia: a consulta lê o que já está gravado.

O risco próprio de um agregador é tornar acessível num lugar o que não era em
outro. Cada origem mantém o recorte que já tinha, e há testes em
`AcervoDeArquivosTests` verificando justamente isso.

### A divergência do PPC

O Projeto Pedagógico do Curso declara o período de oferta em dois lugares que
discordam entre si para XPAD01, CTCO03, CTCO05 e CTCO06. A plataforma segue o
ementário, que descreve a oferta operacional. É um achado da pesquisa, não um
erro de importação, e está registrado no artigo.

### Concatenar transparência a cor de token quebra a declaração

Padrão que reapareceu cinco vezes: `linear-gradient(..., ${cor}dd, ...)`.
Funciona quando `cor` é hexadecimal; quando é `var(--text-secondary)`, a
declaração inteira se torna inválida e o elemento fica transparente. Foi o que
deixou o botão de inscrição invisível. Use tokens completos.

---

## O que está pronto

- Autenticação por CPF com fluxo de primeiro acesso
- Fórum por disciplina com voto, melhor resposta, denúncia e moderação
- Trabalhos em grupo, conversa com áudio e anexo, exclusão de mensagem com
  prazo, pedidos de ajuda com destino automático conforme a disciplina tenha ou
  não monitoria
- Acervo de arquivos agrupado por disciplina
- Voluntariado com inscrição, conclusão e certificado em PDF
- Notificações por WebSocket
- Busca com dois modos, semântica e textual, com queda automática para a
  segunda quando o modelo não está disponível
- Painéis de coordenação, docente e organização
- Acessibilidade: foco visível, atalho para o conteúdo, rótulos para leitor de
  tela, respeito à preferência de movimento reduzido
- Adaptação a telas estreitas: barra lateral vira gaveta abaixo de 1024 pixels
- Implantação em contêiner, no ar em `plataforma-unifei.onrender.com`

Testes: 112 em `colaboracao` e `forum`. **Confirme a contagem total rodando a
suíte antes de citá-la no artigo.**

---

## O que falta

**Da plataforma:**

- Cadastrar os participantes da validação no banco de produção. O plano
  gratuito não dá acesso ao terminal remoto, então o comando
  `cadastrar_participantes` precisa de outro caminho.
- Manter a instância acordada, para os participantes não pegarem a espera de
  hibernação.

**Do artigo:**

- **Requisitos não funcionais.** A Seção 3.1 afirma que foram levantados
  requisitos funcionais e não funcionais, e descreve os segundos como tratando
  de segurança, desempenho, disponibilidade e escalabilidade. Só existe tabela
  para os funcionais, em `tab-requisitos`. A promessa do texto não é cumprida
  pelo documento, e a banca tende a cobrar isso.

  O material para preencher a lacuna já está implementado e pode ser levantado
  do código: autenticação por JWT com lista de negação no Redis, verificação do
  tipo real dos arquivos enviados por assinatura e não por extensão, limites de
  tamanho por tipo de anexo, exclusão lógica preservando histórico, entrega de
  notificação por WebSocket, conformidade com as diretrizes de acessibilidade,
  adaptação a telas estreitas e implantação em contêiner.

- Capturas de tela do painel de coordenação e da tela de trabalhos
- Redesenhar o diagrama entidade-relacionamento, que ainda mostra 17 tabelas
  quando o esquema tem 26
- Regenerar `schema.yml`
- Seção 4.3, depois da validação com usuários
- Seção 5, Conclusões, ainda não escrita
- Confirmar com o orientador a política sobre comitê de ética e sobre a
  declaração de uso de ferramentas de auxílio à escrita

---

## Como trabalhar neste projeto

O código deve ser entregue **em bash, pronto para copiar e colar no VS Code com
WSL**. A autora executa os comandos e devolve a saída.

Não use emojis em lugar nenhum — nem na interface, nem nos comentários, nem nas
respostas. Quando um símbolo for necessário, use imagem real.

Escreva em português com acentuação correta, em registro formal de nível
universitário. Os comentários no código explicam **por que** a decisão foi
tomada, e não o que a linha faz.

`npm run dev` não verifica tipos. Rode `npm run build` antes de qualquer envio:
oito erros de tipo já sobreviveram uma semana de desenvolvimento por causa
disso e só apareceram na implantação.

Não crie arquivos sem que sejam pedidos.
