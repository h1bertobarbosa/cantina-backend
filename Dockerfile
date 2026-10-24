# syntax=docker/dockerfile:1

# ===== BUILD =====
FROM node:24-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN npm run build

RUN npm prune --omit=dev

# ===== RUNTIME =====
FROM gcr.io/distroless/nodejs24-debian13:nonroot AS runner

WORKDIR /app

COPY --from=builder --chown=65532:65532 \
    /app/node_modules ./node_modules

COPY --from=builder --chown=65532:65532 \
    /app/dist ./dist

ENV NODE_ENV=production

EXPOSE 3000

CMD ["dist/main"]
