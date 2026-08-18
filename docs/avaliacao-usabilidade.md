# Roteiro de avaliação com usuários

Instrumento para a validação da Plataforma UNIFEI com a comunidade acadêmica.
Preenche a Subseção 4.3 do artigo.

---

## Antes de tudo: verifique a exigência de comitê de ética

Pesquisa que envolve seres humanos, mesmo em avaliação de usabilidade, pode
exigir aprovação de Comitê de Ética em Pesquisa (CEP), conforme a Resolução
CNS n. 510/2016. Muitos trabalhos de conclusão são dispensados, e outros não.

**Pergunte ao Bruno antes de aplicar.** Coletar dados sem a aprovação
necessária inviabiliza o uso deles no trabalho, e isso só se descobre depois.

---

## 1. Objetivo

Verificar se pessoas da comunidade acadêmica conseguem realizar, sem
treinamento prévio, as tarefas que a plataforma se propõe a resolver — e
identificar onde elas hesitam.

Não se trata de medir satisfação genérica. Cada tarefa foi desenhada para
testar uma afirmação feita no artigo. Se a pessoa não consegue localizar uma
dúvida já respondida, a afirmação de que a plataforma preserva o conhecimento
entre semestres não se sustenta.

## 2. Participantes

**Cinco a oito pessoas.** Acima disso, o retorno por participante cai
rapidamente em teste de usabilidade.

Composição sugerida:

| Perfil | Quantidade | Por quê |
| --- | --- | --- |
| Estudante de graduação | 4 a 5 | Público principal |
| Monitor ou ex-monitor | 1 | Vive o acúmulo de papéis |
| Professor | 1 a 2 | Único que enxerga o painel docente |

Se conseguir, inclua ao menos um estudante de período inicial e um de período
avançado. Eles usam o fórum de formas diferentes.

## 3. Preparação

- [ ] Sistema rodando (`runserver` e `npm run dev`)
- [ ] Banco populado (`criar_perfis_demo --reset` e `popular_demonstracao`)
- [ ] Uma conta separada por participante, para não misturar os dados
- [ ] Termo de consentimento impresso ou digital
- [ ] Cronômetro e folha de anotação (modelo na Seção 6)
- [ ] Gravação de tela, se o participante autorizar

**Não prepare apresentação.** O participante deve chegar sem explicação prévia
da interface — é justamente isso que se está medindo.

## 4. Abertura (leia para o participante)

> Obrigada por participar. Vou te pedir para realizar algumas tarefas em uma
> plataforma que desenvolvi para o meu trabalho de conclusão.
>
> Quem está sendo avaliado é o sistema, não você. Se algo ficar confuso ou
> você não encontrar o que procura, isso é informação valiosa para mim — é
> exatamente o que preciso descobrir.
>
> Peço que pense em voz alta enquanto usa: diga o que está procurando, o que
> espera que aconteça e o que te confundiu. Não vou interromper nem ajudar,
> a não ser que você fique travado por bastante tempo.
>
> Pode desistir de qualquer tarefa ou encerrar a participação a qualquer
> momento. Os dados são anônimos e usados apenas neste trabalho.
>
> Alguma dúvida antes de começarmos?

## 5. Tarefas

Entregue uma tarefa por vez, lendo o enunciado. **Não diga onde clicar.**

### 5.1 Estudante

| # | Tarefa | O que testa |
| --- | --- | --- |
| E1 | Você tem uma dúvida sobre erro de índice em vetor. Descubra se alguém da sua turma já perguntou algo parecido. | Busca semântica — a afirmação central sobre preservação do conhecimento |
| E2 | Não encontrou o que precisava. Publique a sua dúvida na disciplina correta. | Fluxo de publicação e escolha de disciplina |
| E3 | Seu professor propôs um trabalho em grupo. Entre em um grupo que ainda tenha vaga. | Formação de equipes |
| E4 | Combine com o seu grupo por onde começar e, em seguida, encaminhe uma dúvida do grupo para a monitoria. | Chat e pedido de ajuda — o recorte de privacidade |
| E5 | Encontre uma oportunidade de voluntariado com inscrições abertas e inscreva-se. | Descoberta de oportunidade |
| E6 | Descubra quantas horas de voluntariado você já tem registradas. | Percurso e certificados |

### 5.2 Professor

| # | Tarefa | O que testa |
| --- | --- | --- |
| P1 | Descubra em qual das suas disciplinas há dúvidas esperando resposta há mais tempo. | Painel docente |
| P2 | Responda a uma dessas dúvidas. | Fluxo de resposta |
| P3 | Proponha um trabalho em grupo, anexando o enunciado em arquivo, com equipes formadas por sorteio. | Criação de trabalho e material de apoio |
| P4 | Há uma denúncia de conteúdo pendente. Analise e decida. | Moderação com justificativa |

### 5.3 Coordenação

| # | Tarefa | O que testa |
| --- | --- | --- |
| C1 | Identifique qual disciplina do semestre merece atenção da coordenação e explique por quê. | Painel de acompanhamento — a contribuição mais original |
| C2 | Descubra quais disciplinas estão sem professor atribuído. | Sinalização de pendência |

## 6. O que registrar

Para cada tarefa:

- **Concluída sem ajuda / com ajuda / não concluída**
- **Tempo até a conclusão**
- **Onde hesitou** — a tela, o momento, o que a pessoa procurava
- **Frases ditas em voz alta** — anote literalmente, é o dado mais rico

Modelo de anotação:

```
Participante: P3  |  Perfil: estudante, 5º período
Tarefa E1  |  Concluída com ajuda  |  2min40s
Hesitou: procurou a busca no menu lateral antes de ver a barra superior.
Disse: "cadê a lupa? achei que ia ter uma lupa aqui do lado"
```

## 7. Questionário pós-teste

Aplicar a **Escala SUS** (System Usability Scale), instrumento validado e
amplamente usado, o que permite comparar o resultado com outros sistemas.

Escala de 1 (discordo totalmente) a 5 (concordo totalmente):

1. Eu acho que gostaria de usar este sistema com frequência.
2. Eu achei o sistema desnecessariamente complexo.
3. Eu achei o sistema fácil de usar.
4. Eu acho que precisaria de ajuda de uma pessoa com conhecimentos técnicos para usar o sistema.
5. Eu achei que as várias funções do sistema estavam bem integradas.
6. Eu achei que havia muita inconsistência no sistema.
7. Eu imagino que a maioria das pessoas aprenderia a usar este sistema rapidamente.
8. Eu achei o sistema muito difícil de usar.
9. Eu me senti confiante ao usar o sistema.
10. Eu precisei aprender muitas coisas antes de conseguir usar o sistema.

**Cálculo:** nas questões ímpares, subtraia 1 da resposta. Nas pares, subtraia
a resposta de 5. Some os dez valores e multiplique por 2,5. O resultado vai de
0 a 100.

Referência de leitura: 68 é a média histórica dos sistemas avaliados; acima de
80 costuma indicar boa usabilidade. **Não é porcentagem de acerto.**

## 8. Perguntas abertas

Três, ao final, sem induzir resposta:

1. O que mais te incomodou ao usar a plataforma?
2. Você usaria isso no seu dia a dia na universidade? Por quê?
3. O que está faltando?

A segunda pergunta é a mais importante do roteiro. A plataforma disputa espaço
com o WhatsApp, e a resposta a essa pergunta diz mais sobre viabilidade do que
qualquer métrica.

## 9. Como reportar na Seção 4.3

Estrutura sugerida para o texto:

1. Quantos participaram, com qual perfil, e como foram recrutados
2. Tarefas aplicadas e forma de coleta
3. Taxa de conclusão por tarefa, em tabela
4. Pontuação SUS: média e faixa
5. Os pontos de hesitação recorrentes — dois ou três participantes travando no
   mesmo lugar é achado, um só é ruído
6. Comentários espontâneos mais relevantes, entre aspas
7. **Limitações**, escritas com franqueza: número reduzido de participantes,
   ambiente controlado, ausência de uso ao longo de um semestre completo

O item 7 não enfraquece o trabalho. Reconhecer o alcance da própria evidência é
o que separa avaliação de propaganda, e a banca percebe a diferença.
