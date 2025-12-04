import { Injectable, BadRequestException, NotFoundException, forwardRef, Inject } from '@nestjs/common';
import { toSafeUserDto } from '../../common/dto/safe-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FriendRequest } from './friend-request.entity';
import { Friend } from '../friend/friend.entity';
import { User } from '../user/user.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.entity';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';

@Injectable()
export class FriendRequestService {
  constructor(
    @InjectRepository(FriendRequest)
    private readonly friendRequestRepository: Repository<FriendRequest>,
    @InjectRepository(Friend)
    private readonly friendRepository: Repository<Friend>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService: NotificationService,
    @Inject(forwardRef(() => AppWebSocketGateway))
    private readonly webSocketGateway?: AppWebSocketGateway,
  ) {}

  /**
   * Создать заявку в друзья
   */
  async createFriendRequest(senderId: string, receiverId: string, comment?: string): Promise<FriendRequest> {
    // Проверяем, что отправитель и получатель не один и тот же пользователь
    if (senderId === receiverId) {
      throw new BadRequestException('Нельзя отправить заявку самому себе');
    }

    // Проверяем, что получатель существует
    const receiver = await this.userRepository.findOne({ where: { id: receiverId } });
    if (!receiver) {
      throw new NotFoundException('Получатель не найден');
    }

    // Проверяем, что пользователи еще не друзья
    const existingFriend = await this.friendRepository.findOne({
      where: [
        { userId: senderId, friendId: receiverId },
        { userId: receiverId, friendId: senderId }
      ]
    });

    if (existingFriend) {
      throw new BadRequestException('Пользователи уже являются друзьями');
    }

    // Проверяем, что заявка еще не существует
    const existingRequest = await this.friendRequestRepository.findOne({
      where: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId } // Проверяем в обе стороны
      ]
    });

    if (existingRequest) {
      throw new BadRequestException('Заявка уже существует');
    }

    // Создаем новую заявку
    const friendRequest = this.friendRequestRepository.create({
      senderId,
      receiverId,
      comment: comment || undefined
    });

    const savedRequest = await this.friendRequestRepository.save(friendRequest);

    // Загружаем заявку с relations для отправки через WebSocket
    const requestWithRelations = await this.friendRequestRepository.findOne({
      where: { id: savedRequest.id },
      relations: ['sender', 'receiver'],
    });

    // Создаем уведомление для получателя
    try {
      await this.notificationService.createNotification({
        userId: receiverId,
        type: NotificationType.FRIEND_REQUEST_RECEIVED,
        actorId: senderId,
      });
    } catch (error) {
      console.error('Ошибка создания уведомления о заявке в друзья:', error);
      // Не прерываем выполнение, если уведомление не создалось
    }

    // Отправляем через WebSocket получателю заявки
    if (this.webSocketGateway && requestWithRelations) {
      this.webSocketGateway.sendFriendUpdateToUser(receiverId, {
        action: 'request_received',
        request: {
          id: requestWithRelations.id,
          senderId: requestWithRelations.senderId,
          sender: toSafeUserDto(requestWithRelations.sender),
          comment: requestWithRelations.comment,
          createdAt: requestWithRelations.createdAt,
        },
      });
    }

    return savedRequest;
  }

  /**
   * Отменить заявку в друзья
   */
  async cancelFriendRequest(senderId: string, receiverId: string): Promise<void> {
    const friendRequest = await this.friendRequestRepository.findOne({
      where: { senderId, receiverId }
    });

    if (!friendRequest) {
      throw new NotFoundException('Заявка не найдена');
    }

    await this.friendRequestRepository.remove(friendRequest);
  }

  /**
   * Получить все заявки, отправленные пользователем
   */
  async getSentFriendRequests(userId: string): Promise<FriendRequest[]> {
    return await this.friendRequestRepository.find({
      where: { senderId: userId },
      relations: ['receiver'],
      order: { createdAt: 'DESC' }
    });
  }

  /**
   * Получить все заявки, полученные пользователем
   */
  async getReceivedFriendRequests(userId: string): Promise<FriendRequest[]> {
    return await this.friendRequestRepository.find({
      where: { receiverId: userId },
      relations: ['sender'],
      order: { createdAt: 'DESC' }
    });
  }

  /**
   * Получить ID пользователей, которым текущий пользователь отправил заявки
   */
  async getSentFriendRequestIds(userId: string): Promise<string[]> {
    const requests = await this.friendRequestRepository.find({
      where: { senderId: userId },
      select: ['receiverId']
    });
    return requests.map(r => r.receiverId);
  }

  /**
   * Получить ID друзей текущего пользователя
   */
  async getFriendIds(userId: string): Promise<string[]> {
    const friends = await this.friendRepository.find({
      where: { userId },
      select: ['friendId']
    });
    return friends.map(f => f.friendId);
  }

  /**
   * Проверить, отправлена ли заявка от одного пользователя другому
   */
  async hasFriendRequest(senderId: string, receiverId: string): Promise<boolean> {
    const request = await this.friendRequestRepository.findOne({
      where: { senderId, receiverId }
    });
    return !!request;
  }

  /**
   * Получить список пользователей с исходящими заявками (с информацией о пользователях)
   */
  async getSentFriendRequestsWithUsers(userId: string): Promise<any[]> {
    const requests = await this.friendRequestRepository.find({
      where: { senderId: userId },
      relations: ['receiver'],
      order: { createdAt: 'DESC' }
    });

    return requests.map(request => ({
      id: request.id,
      userId: request.receiver.id,
      user: toSafeUserDto(request.receiver),
      comment: request.comment,
      createdAt: request.createdAt
    }));
  }

  /**
   * Получить список пользователей с входящими заявками (с информацией о пользователях)
   */
  async getReceivedFriendRequestsWithUsers(userId: string): Promise<any[]> {
    const requests = await this.friendRequestRepository.find({
      where: { receiverId: userId },
      relations: ['sender'],
      order: { createdAt: 'DESC' }
    });

    return requests.map(request => ({
      id: request.id,
      userId: request.sender.id,
      user: toSafeUserDto(request.sender),
      comment: request.comment,
      createdAt: request.createdAt
    }));
  }

  /**
   * Принять заявку в друзья
   */
  async acceptFriendRequest(receiverId: string, senderId: string): Promise<void> {
    // Проверяем, что заявка существует
    const friendRequest = await this.friendRequestRepository.findOne({
      where: { senderId, receiverId }
    });

    if (!friendRequest) {
      throw new NotFoundException('Заявка не найдена');
    }

    // Проверяем, что пользователи еще не друзья
    const existingFriend = await this.friendRepository.findOne({
      where: [
        { userId: receiverId, friendId: senderId },
        { userId: senderId, friendId: receiverId }
      ]
    });

    if (existingFriend) {
      throw new BadRequestException('Пользователи уже являются друзьями');
    }

    // Создаем две записи о дружбе (взаимная дружба)
    const friend1 = this.friendRepository.create({
      userId: receiverId,
      friendId: senderId
    });

    const friend2 = this.friendRepository.create({
      userId: senderId,
      friendId: receiverId
    });

    await this.friendRepository.save([friend1, friend2]);

    // Удаляем заявку
    await this.friendRequestRepository.remove(friendRequest);

    // Создаем уведомление для отправителя заявки
    try {
      await this.notificationService.createNotification({
        userId: senderId,
        type: NotificationType.FRIEND_REQUEST_ACCEPTED,
        actorId: receiverId,
      });
    } catch (error) {
      console.error('Ошибка создания уведомления о принятии заявки в друзья:', error);
    }

    // Отправляем через WebSocket обоим пользователям
    if (this.webSocketGateway) {
      // Отправителю заявки - заявка принята
      this.webSocketGateway.sendFriendUpdateToUser(senderId, {
        action: 'request_accepted',
        userId: receiverId,
      });
      
      // Получателю заявки - теперь друзья
      this.webSocketGateway.sendFriendUpdateToUser(receiverId, {
        action: 'friend_added',
        userId: senderId,
      });
    }
  }

  /**
   * Отклонить заявку в друзья
   */
  async rejectFriendRequest(receiverId: string, senderId: string): Promise<void> {
    const friendRequest = await this.friendRequestRepository.findOne({
      where: { senderId, receiverId }
    });

    if (!friendRequest) {
      throw new NotFoundException('Заявка не найдена');
    }

    // Удаляем заявку
    await this.friendRequestRepository.remove(friendRequest);

    // Создаем уведомление для отправителя заявки
    try {
      await this.notificationService.createNotification({
        userId: senderId,
        type: NotificationType.FRIEND_REQUEST_REJECTED,
        actorId: receiverId,
      });
    } catch (error) {
      console.error('Ошибка создания уведомления об отклонении заявки в друзья:', error);
    }

    // Отправляем через WebSocket отправителю заявки
    if (this.webSocketGateway) {
      this.webSocketGateway.sendFriendUpdateToUser(senderId, {
        action: 'request_rejected',
        userId: receiverId,
      });
    }
  }

  /**
   * Удалить друга
   */
  async removeFriend(userId: string, friendId: string): Promise<void> {
    // Удаляем обе записи о дружбе (взаимная дружба)
    await this.friendRepository.delete([
      { userId, friendId },
      { userId: friendId, friendId: userId }
    ]);

    // Создаем уведомление для удаленного друга
    try {
      await this.notificationService.createNotification({
        userId: friendId,
        type: NotificationType.FRIEND_REMOVED,
        actorId: userId,
      });
    } catch (error) {
      console.error('Ошибка создания уведомления об удалении из друзей:', error);
    }

    // Отправляем через WebSocket удаленному другу
    if (this.webSocketGateway) {
      this.webSocketGateway.sendFriendUpdateToUser(friendId, {
        action: 'friend_removed',
        userId: userId,
      });
    }
  }

  /**
   * Получить список друзей
   */
  async getFriends(userId: string): Promise<any[]> {
    const friends = await this.friendRepository.find({
      where: { userId },
      relations: ['friend'],
      order: { createdAt: 'DESC' }
    });

    return friends.map(friend => ({
      id: friend.id,
      userId: friend.friend.id,
      user: toSafeUserDto(friend.friend),
      createdAt: friend.createdAt
    }));
  }
}

