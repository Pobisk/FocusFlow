FROM node:20-alpine

WORKDIR /app

# Копируем только package-файлы для кэширования зависимостей
COPY package*.json ./

RUN npm ci --only=production

# Копируем исходники
COPY . .

# Собираем приложение
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
