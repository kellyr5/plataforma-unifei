# Implantação gratuita

Passo a passo para colocar a plataforma no ar sem custo, para a avaliação com
usuários. Estimativa realista: **duas a três horas**, contando os erros da
primeira tentativa — implantação sempre falha na primeira.

## Arranjo

| Peça | Serviço | Limite gratuito |
| --- | --- | --- |
| Aplicação | Render | 512 MB, 750 h/mês |
| Banco | Neon | 0,5 GB, sem expiração |
| Mídia | Cloudflare R2 | 10 GB, sem custo de saída |

O Redis não entra: com uma instância só, a camada em memória do Channels
resolve o WebSocket e o cache local guarda os tokens.

A busca semântica fica desligada. O modelo exige mais de 2 GB de RAM e o plano
gratuito tem 512 MB. A busca cai para correspondência de termos — comportamento
já previsto no código. **Registre isso como limitação na Seção 4 do artigo.**

---

## 1. Banco de dados (Neon)

1. Crie conta em `neon.tech` e um projeto.
2. Copie a *connection string*, no formato
   `postgresql://usuario:senha@host/banco?sslmode=require`.
3. Guarde: será a variável `DATABASE_URL`.

Se quiser a busca semântica funcionando mais tarde, a Neon suporta pgvector —
basta rodar `CREATE EXTENSION vector;` no console SQL dela.

## 2. Armazenamento (Cloudflare R2)

1. Crie conta em `cloudflare.com` e ative o R2.
2. Crie um bucket, por exemplo `plataforma-unifei`.
3. Em **R2 → Manage API Tokens**, gere um token com permissão de leitura e
   escrita. Anote a chave e o segredo.
4. Em **Settings → Public access**, ative o domínio público do bucket e copie
   o endereço. Sem isso, as imagens não abrem no navegador.

Você vai precisar de três valores: a chave, o segredo e o *endpoint*, que tem
o formato `https://<ID_DA_CONTA>.r2.cloudflarestorage.com`.

## 3. Aplicação (Render)

1. Suba o projeto para o GitHub, se ainda não subiu.
2. Em `render.com`, crie um **Web Service** apontando para o repositório.
3. Em **Language**, escolha **Docker**. Ele encontra o `Dockerfile` sozinho.
4. Plano: **Free**.

### Variáveis de ambiente

```
SECRET_KEY              (gere uma nova, não reaproveite a local)
DEBUG                   False
ALLOWED_HOSTS           seu-servico.onrender.com
CSRF_TRUSTED_ORIGINS    https://seu-servico.onrender.com
DATABASE_URL            postgresql://... (da Neon)
USAR_REDIS              False
BUSCA_SEMANTICA_ATIVA   False
SECURE_HSTS_SECONDS     3600
CARGA_INICIAL           true      ← apenas na primeira implantação

AWS_STORAGE_BUCKET_NAME  plataforma-unifei
AWS_ACCESS_KEY_ID        (do R2)
AWS_SECRET_ACCESS_KEY    (do R2)
AWS_S3_ENDPOINT_URL      https://<ID>.r2.cloudflarestorage.com
AWS_S3_CUSTOM_DOMAIN     pub-xxxx.r2.dev
```

Para gerar a `SECRET_KEY`:

```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### Depois da primeira implantação

**Mude `CARGA_INICIAL` para `false`.** Se ficar em `true`, cada reinício apaga
o que os participantes produziram — que é justamente o dado que você quer
observar.

## 4. Manter o serviço acordado

O plano gratuito desliga o serviço após 15 minutos sem acesso e leva cerca de
um minuto para voltar. Numa avaliação sem acompanhamento isso custa
participante: a pessoa abre o link, vê tela branca e desiste.

Como o plano dá 750 horas por mês e o mês tem 730, dá para manter o serviço
sempre acordado. Em `cron-job.org`, gratuito, crie uma tarefa que acesse
`https://seu-servico.onrender.com/api/auth/estatisticas/` a cada 10 minutos.
Esse endereço é público e leve, e existe justamente para a tela de entrada.

## 5. Cadastrar os participantes

Com o serviço no ar, no **Shell** do Render:

```bash
python manage.py cadastrar_participantes docs/participantes.csv --conferir
python manage.py cadastrar_participantes docs/participantes.csv
```

Cada pessoa entra pelo **Primeiro Acesso**, informando o CPF e o e-mail
cadastrados, e cria a própria senha ali.

---

## Verificação antes de convidar alguém

- [ ] A tela de entrada abre e mostra os números
- [ ] Primeiro acesso funciona com um CPF da planilha
- [ ] O fórum lista as disciplinas do perfil
- [ ] Uma mensagem no chat de grupo chega em outra janela **sem recarregar**
- [ ] O envio de foto de perfil funciona e a imagem aparece depois de recarregar
- [ ] O PDF do certificado abre

O quarto item é o que mais falha, porque testa o WebSocket atrás do HTTPS.
Se quebrar, confira `CSRF_TRUSTED_ORIGINS` e se o endereço está em
`ALLOWED_HOSTS`.

O quinto verifica o R2. Se a imagem some ao recarregar, o armazenamento
externo não assumiu e o arquivo foi para o disco efêmero.
