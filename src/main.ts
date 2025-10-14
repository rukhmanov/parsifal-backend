import { NestFactory } from '@nestjs/core';
import { ValidationPipe, RequestMethod } from '@nestjs/common';
import helmet from 'helmet';
import * as cors from 'cors';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

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
        'http://192.168.1.31:8100'
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

  // Устанавливаем глобальный префикс для API, исключая корневой эндпоинт
  app.setGlobalPrefix('api', {
    exclude: [{ path: '', method: RequestMethod.GET }],
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
}

bootstrap().catch(() => {
  process.exit(1);
});