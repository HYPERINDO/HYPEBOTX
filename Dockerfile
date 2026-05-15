FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    curl \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

RUN mkdir -p /app/storage /app/storage/temp /app/storage/transcripts /app/logs /app/backups

EXPOSE 8787
EXPOSE 3000

CMD ["npm", "start"]