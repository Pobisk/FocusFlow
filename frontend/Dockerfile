# ── Stage 1: Build ─────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Копируем только package.json и lock-файл для кэширования зависимостей
COPY package*.json ./
RUN npm ci --ignore-scripts

# Копируем исходный код и собираем
COPY . .
RUN npm run build

# ── Stage 2: Serve with nginx ──────────────────────────
FROM nginx:stable-alpine

# Копируем собранный бандл
COPY --from=builder /app/dist /usr/share/nginx/html

# Копируем конфигурацию nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Health check для nginx (BusyBox wget — используем 127.0.0.1 вместо localhost из-за IPv6)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q --spider http://127.0.0.1:80/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
