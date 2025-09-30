# Auth Entity

Модуль авторизации для NestJS приложений.

## Структура

```
auth/
├── auth.controller.ts      # Контроллер для API эндпоинтов
├── auth.service.ts         # Основной сервис авторизации
├── auth.module.ts          # Модуль NestJS
├── dto/                    # Data Transfer Objects
│   ├── login.dto.ts
│   └── register.dto.ts
└── strategies/             # Passport стратегии
    ├── google.strategy.ts
    ├── jwt.strategy.ts
    ├── local.strategy.ts
    └── yandex.strategy.ts
```

## Использование

1. Импортируйте `AuthModule` в ваш основной модуль:

```typescript
import { AuthModule } from './entities/auth/auth.module';

@Module({
  imports: [AuthModule],
  // ...
})
export class AppModule {}
```

2. Настройте переменные окружения:

```env
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=1h
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
YANDEX_CLIENT_ID=your-yandex-client-id
YANDEX_CLIENT_SECRET=your-yandex-client-secret
```

## API Эндпоинты

- `POST /api/auth/register` - Регистрация пользователя
- `POST /api/auth/login` - Локальная авторизация
- `GET /api/auth/google` - Google OAuth
- `GET /api/auth/yandex` - Yandex OAuth
- `POST /api/auth/google/token` - Обмен кода на токен (Google)
- `POST /api/auth/yandex/token` - Обмен кода на токен (Yandex)
- `GET /api/auth/google/userinfo` - Получение данных пользователя (Google)
- `GET /api/auth/yandex/userinfo` - Получение данных пользователя (Yandex)

## Перенос в другой проект

1. Скопируйте папку `auth` в `src/entities/` нового проекта
2. Установите зависимости:
   ```bash
   npm install @nestjs/jwt @nestjs/passport passport passport-jwt passport-local passport-google-oauth20 passport-yandex
   ```
3. Импортируйте `AuthModule` в основной модуль
4. Настройте переменные окружения
5. Обновите CORS настройки в `main.ts` для вашего frontend URL
