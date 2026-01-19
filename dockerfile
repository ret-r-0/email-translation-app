# Используем официальный образ Node.js
FROM node:latest

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY backend/package.json backend/package-lock.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем весь код приложения
COPY backend/ ./

# Открываем порт 3000
EXPOSE 3000

# Запускаем сервер
CMD ["npm", "start"]
