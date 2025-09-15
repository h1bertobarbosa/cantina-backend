# Etapa 1: Construção da aplicação
FROM node:22-slim AS builder

# Define o diretório de trabalho dentro do container
WORKDIR /app

# Copia o package.json e package-lock.json (se existir)
COPY package*.json ./

# Instala as dependências de desenvolvimento para compilar a aplicação
RUN npm install

# Copia o restante dos arquivos da aplicação
COPY . .

# Compila o projeto NestJS
RUN npm run build

# Instala apenas as dependências de produção
RUN npm install --omit=dev
# Etapa 2: Container final
FROM node:22-slim AS production

# Define o diretório de trabalho dentro do container
WORKDIR /app

# Copia as dependências de produção da etapa anterior
COPY --from=builder /app/node_modules ./node_modules

# Copia a build gerada na etapa anterior
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/.env.prd ./dist/.env
COPY --from=builder /app/.env.prd .env

# Define a variável de ambiente para produção
ENV NODE_ENV=production

# Expõe a porta que a aplicação vai usar
EXPOSE 3000

# Comando para iniciar a aplicação
CMD ["node", "dist/main"]

