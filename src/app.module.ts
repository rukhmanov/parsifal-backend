import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './entities/auth/auth.module';
import { UserModule } from './entities/user/user.module';
import { PermissionModule } from './entities/permission/permission.module';
import { RoleModule } from './entities/role/role.module';
import { FileModule } from './entities/file/file.module';
import { StatisticsModule } from './entities/statistics/statistics.module';
import { EventModule } from './entities/event/event.module';
import { FriendRequestModule } from './entities/friend-request/friend-request.module';
import { EventParticipationRequestModule } from './entities/event-participation-request/event-participation-request.module';
import { ChatModule } from './entities/chat/chat.module';
import { PollingModule } from './entities/polling/polling.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('POSTGRESQL_HOST', 'localhost'),
        port: configService.get('POSTGRESQL_PORT', 5432),
        username: configService.get('POSTGRESQL_USER', 'aleksrukhmanov'),
        password: configService.get('POSTGRESQL_PASSWORD', ''),
        database: configService.get('POSTGRESQL_DBNAME', 'parsifal_db'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get('NODE_ENV') !== 'production', // Только для разработки
        logging: false,
      }),
      inject: [ConfigService],
    }),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        transport: {
          host: configService.get('SMTP_HOST', 'smtp.mail.ru'),
          port: configService.get('SMTP_PORT', 587),
          secure: configService.get('SMTP_PORT') === '465',
          auth: {
            user: configService.get('SMTP_USER'),
            pass: configService.get('SMTP_PASS'),
          },
        },
        defaults: {
          from: configService.get('FROM_EMAIL', configService.get('SMTP_USER')),
        },
        template: {
          dir: process.cwd() + '/dist/views',
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UserModule,
    PermissionModule,
    RoleModule,
    FileModule,
    StatisticsModule,
    EventModule,
    FriendRequestModule,
    EventParticipationRequestModule,
    ChatModule,
    PollingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}