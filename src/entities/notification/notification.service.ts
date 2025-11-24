import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Notification, NotificationType } from './notification.entity';

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

    return await this.notificationRepository.save(notification);
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

