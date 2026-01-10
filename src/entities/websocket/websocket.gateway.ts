import {
  WebSocketGateway as WSGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { NotificationService } from '../notification/notification.service';
import { User } from '../user/user.entity';

interface AuthenticatedSocket extends Socket {
  user?: User;
}

@WSGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/ws',
})
@Injectable()
export class AppWebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(AppWebSocketGateway.name);
  private readonly connectedUsers = new Map<string, AuthenticatedSocket>();

  constructor(
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService: NotificationService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Получаем токен из query параметров или auth объекта
      const token = (client.handshake.query.token as string) || 
                    (client.handshake.auth?.token as string);

      if (!token) {
        this.logger.warn(`Connection rejected: No token provided`);
        client.disconnect();
        return;
      }

      // Валидируем токен и получаем пользователя
      const user = await this.authService.validateJwtToken(token);
      
      if (!user) {
        this.logger.warn(`Connection rejected: Invalid token`);
        client.disconnect();
        return;
      }

      // Сохраняем пользователя в сокете
      client.user = user;
      this.connectedUsers.set(user.id, client);

      this.logger.log(`User connected: ${user.email} (${user.id})`);
      
      // Отправляем подтверждение подключения
      client.emit('connected', {
        message: 'WebSocket connection established',
        userId: user.id,
      });

      // Отправляем последние уведомления при подключении
      const notifications = await this.notificationService.getNotifications(user.id, 15);
      if (notifications.length > 0) {
        client.emit('notifications', notifications);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Connection error: ${errorMessage}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    if (client.user) {
      this.connectedUsers.delete(client.user.id);
      this.logger.log(`User disconnected: ${client.user.email} (${client.user.id})`);
    }
  }

  /**
   * Отправить уведомление конкретному пользователю
   */
  sendNotificationToUser(userId: string, notification: any) {
    const client = this.connectedUsers.get(userId);
    if (client) {
      client.emit('notification', notification);
      this.logger.log(`Notification sent to user: ${userId}`);
    } else {
      this.logger.warn(`User not connected: ${userId}`);
    }
  }

  /**
   * Отправить сообщение конкретному пользователю
   */
  sendMessageToUser(userId: string, message: any) {
    const client = this.connectedUsers.get(userId);
    if (client) {
      client.emit('message', message);
      this.logger.log(`Message sent to user: ${userId}`);
    }
  }

  /**
   * Отправить обновление события конкретному пользователю
   */
  sendEventUpdateToUser(userId: string, event: any) {
    const client = this.connectedUsers.get(userId);
    if (client) {
      client.emit('event_update', event);
      this.logger.log(`Event update sent to user: ${userId}`);
    }
  }

  /**
   * Отправить обновление друзей конкретному пользователю
   */
  sendFriendUpdateToUser(userId: string, update: any) {
    const client = this.connectedUsers.get(userId);
    if (client) {
      client.emit('friend_update', update);
      this.logger.log(`Friend update sent to user: ${userId}`);
    }
  }

  /**
   * Отправить сообщение чата конкретному пользователю
   */
  sendChatMessageToUser(userId: string, data: any) {
    const client = this.connectedUsers.get(userId);
    if (client) {
      client.emit('chat_message', data);
      this.logger.log(`Chat message sent to user: ${userId}`);
    }
  }

  /**
   * Проверить, подключен ли пользователь
   */
  isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  /**
   * Получить количество подключенных пользователей
   */
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }
}

