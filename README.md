# Secure Auth Backend

Современный бэкенд для аутентификации с использованием NestJS и строгой типизации TypeScript.

## Особенности

- ✅ **Строгая типизация TypeScript** - все настройки strict включены
- ✅ **NestJS 11** - последняя версия фреймворка
- ✅ **OAuth 2.0** - поддержка Google и Yandex
- ✅ **JWT токены** - безопасная аутентификация
- ✅ **Валидация** - автоматическая валидация данных
- ✅ **Безопасность** - Helmet, CORS, защита от атак

## Установка

```bash
cd backend
npm install
```

## Настройка

1. Скопируйте файл конфигурации:
```bash
cp env.example .env
```

2. Заполните переменные окружения в `.env`:
```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Frontend URL
FRONTEND_URL=http://localhost:8100

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=1h

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# Yandex OAuth Configuration
YANDEX_CLIENT_ID=your-yandex-client-id
YANDEX_CLIENT_SECRET=your-yandex-client-secret
YANDEX_CALLBACK_URL=http://localhost:3000/auth/yandex/callback
```

## Запуск

### Разработка
```bash
npm run start:dev
```

### Продакшн
```bash
npm run build
npm run start:prod
```

## API Endpoints

### Google OAuth
- `GET /auth/google` - начать аутентификацию через Google
- `GET /auth/google/callback` - callback от Google

### Yandex OAuth
- `GET /auth/yandex/callback?code=...` - callback от Yandex

### Защищенные маршруты
- `GET /auth/profile` - получить профиль пользователя (требует JWT токен)

## Типизация

Проект использует строгую типизацию TypeScript:

- `strict: true` - включены все строгие проверки
- `noImplicitAny: true` - запрещены неявные any
- `strictNullChecks: true` - строгая проверка null/undefined
- `strictFunctionTypes: true` - строгая проверка типов функций
- `strictPropertyInitialization: true` - обязательная инициализация свойств

## Структура проекта

```
src/
├── auth/
│   ├── auth.controller.ts    # Контроллер аутентификации
│   ├── auth.module.ts        # Модуль аутентификации
│   ├── auth.service.ts       # Сервис аутентификации
│   └── strategies/
│       ├── google.strategy.ts    # Google OAuth стратегия
│       ├── jwt.strategy.ts       # JWT стратегия
│       └── yandex.strategy.ts    # Yandex OAuth стратегия
├── app.module.ts             # Главный модуль
└── main.ts                   # Точка входа
```

## Безопасность

- JWT токены с настраиваемым временем жизни
- Валидация всех входящих данных
- Защита от CSRF и XSS атак
- CORS настроен для фронтенда
- Переменные окружения для секретов

## Разработка

### Линтинг
```bash
npm run lint
```

### Тестирование
```bash
npm run test
npm run test:e2e
```

### Форматирование
```bash
npm run format
```