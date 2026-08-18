# Imagem unica: constroi o frontend, junta ao Django e serve os dois pelo
# mesmo processo. Manter API e interface no mesmo endereco elimina CORS e faz
# o WebSocket apontar para a propria origem, sem configuracao no cliente.

# ---------- Etapa 1: build do React ----------
FROM node:22-slim AS frontend

WORKDIR /app/frontend

# Copiar apenas os manifestos antes do codigo aproveita o cache do Docker: a
# instalacao das dependencias so refaz quando elas mudam, e nao a cada commit.
COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


# ---------- Etapa 2: aplicacao ----------
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# O WeasyPrint gera o PDF do certificado e depende destas bibliotecas do
# sistema para renderizar texto e vetores. Sem elas a importacao falha.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpango-1.0-0 \
        libpangoft2-1.0-0 \
        libcairo2 \
        libgdk-pixbuf-2.0-0 \
        libffi-dev \
        shared-mime-info \
        fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Traz o build do React para dentro do projeto, onde o collectstatic o encontra.
COPY --from=frontend /app/frontend/dist ./frontend/dist

RUN chmod +x ./deploy/iniciar.sh

EXPOSE 8000

CMD ["./deploy/iniciar.sh"]
