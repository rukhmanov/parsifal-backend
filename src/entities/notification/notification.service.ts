import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Notification, NotificationType } from './notification.entity';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';

export interface CreateNotificationDto {
  userId: string;
  type: NotificationType;
  actorId?: string;
  eventId?: string;
  chatId?: string;
  message?: string;
}

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @Inject(forwardRef(() => AppWebSocketGateway))
    private readonly webSocketGateway?: AppWebSocketGateway,
  ) {}

  /**
   * Создать уведомление
   */
  async createNotification(dto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationRepository.create({
      userId: dto.userId,
      type: dto.type,
      actorId: dto.actorId,
      eventId: dto.eventId,
      chatId: dto.chatId,
      message: dto.message,
      isRead: false,
    });

    const savedNotification = await this.notificationRepository.save(notification);

    // Загружаем полные данные уведомления с relations для отправки через WebSocket
    const fullNotification = await this.notificationRepository.findOne({
      where: { id: savedNotification.id },
      relations: ['actor', 'event'],
    });

    if (fullNotification) {
      const notificationData = {
        id: fullNotification.id,
        type: fullNotification.type,
        actor: fullNotification.actor ? {
          id: fullNotification.actor.id,
          email: fullNotification.actor.email,
          firstName: fullNotification.actor.firstName,
          lastName: fullNotification.actor.lastName,
          displayName: fullNotification.actor.displayName,
          avatar: fullNotification.actor.avatar,
        } : null,
        event: fullNotification.event ? {
          id: fullNotification.event.id,
          title: fullNotification.event.title,
        } : null,
        eventId: fullNotification.eventId,
        chatId: fullNotification.chatId,
        message: fullNotification.message,
        isRead: fullNotification.isRead,
        createdAt: fullNotification.createdAt,
      };

      // Отправляем уведомление через WebSocket
      if (this.webSocketGateway) {
        this.webSocketGateway.sendNotificationToUser(dto.userId, notificationData);
      }
    }

    return savedNotification;
  }

  /**
   * Получить историю уведомлений для пользователя
   */
  async getNotifications(userId: string, limit: number = 50, before?: Date): Promise<any[]> {
    const where: any = { userId };
    
    if (before) {
      where.createdAt = LessThan(before);
    }

    const notifications = await this.notificationRepository.find({
      where,
      relations: ['actor', 'event'],
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return notifications.map(notification => ({
      id: notification.id,
      type: notification.type,
      actor: notification.actor ? {
        id: notification.actor.id,
        email: notification.actor.email,
        firstName: notification.actor.firstName,
        lastName: notification.actor.lastName,
        displayName: notification.actor.displayName,
        avatar: notification.actor.avatar,
      } : null,
      event: notification.event ? {
        id: notification.event.id,
        title: notification.event.title,
      } : null,
      eventId: notification.eventId,
      chatId: notification.chatId,
      message: notification.message,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    }));
  }

  /**
   * Отметить уведомление как прочитанное
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.notificationRepository.update(
      { id: notificationId, userId },
      { isRead: true }
    );
  }

  /**
   * Отметить все уведомления как прочитанные
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true }
    );
  }

  /**
   * Получить количество непрочитанных уведомлений
   */
  async getUnreadCount(userId: string): Promise<number> {
    return await this.notificationRepository.count({
      where: { userId, isRead: false },
    });
  }
}

