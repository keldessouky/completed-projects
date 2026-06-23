# Single-stage image kept intentionally simple: it includes the Prisma CLI and
# ts-node so migrations and the demo seed can run at container start.
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

EXPOSE 3000

ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
