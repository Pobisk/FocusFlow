FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

# 👇 Используем современный флаг --omit=dev
# 👇 Если нет package-lock.json, npm ci упадёт — поэтому лучше npm install для минимального старта
RUN npm install --omit=dev

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
