FROM node:22-alpine AS build
ENV XDG_CACHE_HOME=/app/.cache
WORKDIR /app
RUN apk add --no-cache openssl
COPY . .
ARG DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npm ci --ignore-scripts --no-audit --no-fund \
 && npm run generate \
 && npm run build -w packages/contracts -w packages/core -w packages/bus \
 && for s in auth catalog inventory cart orders payments notifications gateway; do npm run build -w services/$s; done \
 && cd services/auth && node /app/node_modules/prisma/build/index.js version

FROM node:22-alpine
ENV NODE_ENV=production
ENV XDG_CACHE_HOME=/app/.cache
WORKDIR /app
RUN apk add --no-cache tini openssl
COPY --from=build /app /app
COPY docker/start.sh /usr/local/bin/start-service
RUN chmod +x /usr/local/bin/start-service && chown -R node:node /app
USER node
ENTRYPOINT ["/sbin/tini", "--", "start-service"]
