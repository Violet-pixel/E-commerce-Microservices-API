FROM node:22-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci --ignore-scripts --no-audit --no-fund \
 && npm run build -w apps/web

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
