# Используем официальный образ Node.js
FROM node:22-slim

# Включаем corepack для работы с pnpm (если используется)
RUN corepack enable

# Устанавливаем необходимые системные пакеты
RUN DEBIAN_FRONTEND=noninteractive apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Устанавливаем NestJS CLI глобально
RUN npm install -g @nestjs/cli

# Создаем пользователя для безопасности
RUN groupadd --gid 2000 app && useradd --uid 2000 --gid 2000 -m -s /bin/bash app

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем файлы зависимостей для лучшего кэширования
COPY package.json package-lock.json* ./

# Устанавливаем зависимости
RUN npm ci --only=production && npm cache clean --force

# Копируем исходный код
COPY . .

# Собираем приложение
RUN npm run build

# Меняем владельца файлов на пользователя app
RUN chown -R app:app /app

# Переключаемся на пользователя app
USER app

# Открываем порт
EXPOSE 3000

# Запускаем приложение
CMD ["npm", "run", "start:prod"]

