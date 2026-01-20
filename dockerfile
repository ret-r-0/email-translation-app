# Используем Node.js образ
FROM node:14

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем все остальные файлы
COPY . .

# Запускаем приложение
CMD ["npm", "start"]

# Указываем порт для приложения
EXPOSE 3000
