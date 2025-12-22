import { NestFactory } from '@nestjs/core';
import { ValidationPipe, RequestMethod } from '@nestjs/common';
import helmet from 'helmet';
import * as cors from 'cors';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: function (origin, callback) {
      const allowedOrigins = [
        process.env.FRONTEND_URL || 'http://localhost:8100',
        'http://localhost:4200', // Angular dev server
        'http://localhost:3000', // Backend port (for testing)
        'capacitor://localhost',
        'ionic://localhost',
        'http://localhost',
        'http://127.0.0.1:8100',
        'http://127.0.0.1:4200',
        'http://127.0.0.1:3000',
        'http://192.168.1.31:8100',
        'https://rukhmanov-parsifal-frontend-e1d5.twc1.net',
        'https://parsefal.ru'
      ];
      
      // Разрешаем запросы без origin (например, из Postman)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  }));

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger configuration (BEFORE global prefix)
  const config = new DocumentBuilder()
    .setTitle('Parsifal API')
    .setDescription('API для системы управления пользователями Parsifal')
    .setVersion('1.0')
    .addServer('/api', 'API с префиксом /api')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Введите JWT токен',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('auth', 'Авторизация и аутентификация')
    .addTag('users', 'Управление пользователями')
    .addTag('roles', 'Управление ролями')
    .addTag('permissions', 'Управление разрешениями')
    .addTag('files', 'Управление файлами')
    .addTag('statistics', 'Статистика')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  
  // Setup Swagger on root path /docs (not /api/docs)
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Устанавливаем глобальный префикс для API, исключая корневой эндпоинт, docs и WebSocket
  app.setGlobalPrefix('api', {
    exclude: [
      { path: '', method: RequestMethod.GET },
      { path: 'docs', method: RequestMethod.ALL },
      { path: 'docs/(.*)', method: RequestMethod.ALL },
      { path: 'ws', method: RequestMethod.ALL },
      { path: 'ws/(.*)', method: RequestMethod.ALL },
    ],
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log(`🚀 Приложение запущено на порту ${port}`);
  console.log(`📚 Swagger документация доступна по адресу: http://localhost:${port}/docs`);
}

bootstrap().catch(() => {
  process.exit(1);
});
