import { Injectable, BadRequestException, NotFoundException, ForbiddenException, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventParticipationRequest } from './event-participation-request.entity';
import { Event } from '../event/event.entity';
import { User } from '../user/user.entity';
import { Friend } from '../friend/friend.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.entity';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { ChatService } from '../chat/chat.service';
import { toSafeUserDto, toSafeUserDtoArray } from '../../common/dto/safe-user.dto';

@Injectable()
export class EventParticipationRequestService {
  constructor(
    @InjectRepository(EventParticipationRequest)
    private readonly requestRepository: Repository<EventParticipationRequest>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Friend)
    private readonly friendRepository: Repository<Friend>,
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService: NotificationService,
    @Inject(forwardRef(() => AppWebSocketGateway))
    private readonly webSocketGateway?: AppWebSocketGateway,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService?: ChatService,
  ) {}

  /**
   * Отправить приглашение на участие в событии (от создателя события)
   */
  async sendInvitation(eventId: string, userId: string, creatorId: string, comment?: string): Promise<EventParticipationRequest> {
    // Проверяем, что событие существует
    const event = await this.eventRepository.findOne({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException('Событие не найдено');
    }

    // Проверяем, что пользователь является создателем события
    if (event.creatorId !== creatorId) {
      throw new ForbiddenException('Только создатель события может отправлять приглашения');
    }

    // Проверяем, что пользователь существует
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    // Проверяем, что пользователь не является создателем события
    if (userId === creatorId) {
      throw new BadRequestException('Нельзя отправить приглашение самому себе');
    }

    // Проверяем, что пользователь уже не является участником
    const eventWithParticipants = await this.eventRepository.findOne({
      where: { id: eventId },
      relations: ['participants']
    });
    if (eventWithParticipants?.participants.some(p => p.id === userId)) {
      throw new BadRequestException('Пользователь уже является участником события');
    }

    // Проверяем, что активная заявка еще не существует
    const existingRequest = await this.requestRepository.findOne({
      where: { eventId, userId, status: 'pending' }
    });

    if (existingRequest) {
      throw new BadRequestException('Приглашение уже отправлено');
    }

    // Создаем приглашение
    const request = this.requestRepository.create({
      eventId,
      userId,
      status: 'pending',
      type: 'invitation',
      comment: comment || undefined
    });

    const savedRequest = await this.requestRepository.save(request);

    // Загружаем заявку с relations для отправки через WebSocket
    const requestWithRelations = await this.requestRepository.findOne({
      where: { id: savedRequest.id },
      relations: ['user', 'event'],
    });

    // Создаем уведомление для приглашенного пользователя
    try {
      await this.notificationService.createNotification({
        userId: userId,
        type: NotificationType.EVENT_REQUEST_RECEIVED,
        actorId: creatorId,
        eventId: eventId,
      });
    } catch (error) {
      console.error('Ошибка создания уведомления о приглашении на событие:', error);
    }

    // Отправляем через WebSocket приглашенному пользователю
    if (this.webSocketGateway && requestWithRelations) {
      this.webSocketGateway.sendEventUpdateToUser(userId, {
        action: 'invitation_received',
        eventId: eventId,
        request: {
          id: requestWithRelations.id,
          eventId: requestWithRelations.eventId,
          comment: requestWithRelations.comment,
          createdAt: requestWithRelations.createdAt,
        },
      });
    }

    return savedRequest;
  }

  /**
   * Отправить заявку на участие в событии (от пользователя)
   */
  async sendApplication(
    eventId: string, 
    userId: string,
    requirementsData?: {
      ageMatches?: boolean;
      genderMatches?: boolean;
      itemsCanBring?: string[];
      canBringMoney?: boolean;
      meetsRequirements?: boolean;
      comment?: string;
    }
  ): Promise<EventParticipationRequest> {
    // Проверяем, что событие существует
    const event = await this.eventRepository.findOne({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException('Событие не найдено');
    }

    // Проверяем, что пользователь не является создателем события
    if (event.creatorId === userId) {
      throw new BadRequestException('Создатель события не может подавать заявку');
    }

    // Проверяем, что пользователь уже не является участником
    const eventWithParticipants = await this.eventRepository.findOne({
      where: { id: eventId },
      relations: ['participants']
    });
    if (eventWithParticipants?.participants.some(p => p.id === userId)) {
      throw new BadRequestException('Вы уже являетесь участником события');
    }

    // Проверяем, существует ли активная заявка (pending)
    const existingRequest = await this.requestRepository.findOne({
      where: { eventId, userId, status: 'pending' }
    });

    if (existingRequest) {
      throw new BadRequestException('Заявка уже существует');
    }

    // Создаем новую заявку с информацией о соответствии требованиям
    const request = this.requestRepository.create({
      eventId,
      userId,
      status: 'pending',
      type: 'application',
      ageMatches: requirementsData?.ageMatches,
      genderMatches: requirementsData?.genderMatches,
      itemsCanBring: requirementsData?.itemsCanBring,
      canBringMoney: requirementsData?.canBringMoney,
      meetsRequirements: requirementsData?.meetsRequirements ?? false,
      comment: requirementsData?.comment || undefined
    });

    const savedRequest = await this.requestRepository.save(request);

    // Загружаем заявку с relations для отправки через WebSocket
    const requestWithRelations = await this.requestRepository.findOne({
      where: { id: savedRequest.id },
      relations: ['user', 'event'],
    });

    // Создаем уведомление для создателя события
    try {
      await this.notificationService.createNotification({
        userId: event.creatorId,
        type: NotificationType.EVENT_REQUEST_RECEIVED,
        actorId: userId,
        eventId: eventId,
      });
    } catch (error) {
      console.error('Ошибка создания уведомления о заявке на событие:', error);
    }

    // Отправляем через WebSocket создателю события
    if (this.webSocketGateway && requestWithRelations) {
      this.webSocketGateway.sendEventUpdateToUser(event.creatorId, {
        action: 'request_received',
        eventId: eventId,
        request: {
          id: requestWithRelations.id,
          userId: requestWithRelations.userId,
          user: {
            id: requestWithRelations.user.id,
            email: requestWithRelations.user.email,
            firstName: requestWithRelations.user.firstName,
            lastName: requestWithRelations.user.lastName,
            displayName: requestWithRelations.user.displayName,
            avatar: requestWithRelations.user.avatar,
          },
          comment: requestWithRelations.comment,
          createdAt: requestWithRelations.createdAt,
        },
      });
    }

    return savedRequest;
  }

  /**
   * Принять заявку/приглашение
   */
  async acceptRequest(requestId: string, userId: string): Promise<void> {
    const request = await this.requestRepository.findOne({
      where: { id: requestId },
      relations: ['event', 'user']
    });

    if (!request) {
      throw new NotFoundException('Заявка не найдена');
    }

    // Проверяем права: для приглашений может принять только приглашенный пользователь
    // Для заявок может принять только создатель события
    if (request.type === 'invitation') {
      if (request.userId !== userId) {
        throw new ForbiddenException('Только приглашенный пользователь может принять приглашение');
      }
    } else {
      // application
      if (request.event.creatorId !== userId) {
        throw new ForbiddenException('Только создатель события может принять заявку');
      }
    }

    // Проверяем максимальное количество участников
    const event = await this.eventRepository.findOne({
      where: { id: request.eventId },
      relations: ['participants']
    });

    if (event && event.maxParticipants && event.participants.length >= event.maxParticipants) {
      throw new BadRequestException('Достигнуто максимальное количество участников');
    }

    // Добавляем пользователя в участники события
    if (event && !event.participants.some(p => p.id === request.userId)) {
      event.participants.push(request.user);
      await this.eventRepository.save(event);

      // Если существует чат события, добавляем пользователя в чат
      try {
        if (this.chatService) {
          const eventChat = await this.chatService.findEventChatByEventId(request.eventId);
          if (eventChat) {
            await this.chatService.addParticipantsToChat(eventChat.id, [request.userId]);
          }
        }
      } catch (error) {
        console.error('Ошибка добавления участника в чат события:', error);
        // Не прерываем выполнение, если не удалось добавить в чат
      }

      // Отправляем системное сообщение в чат события о вступлении участника
      try {
        if (this.chatService) {
          await this.chatService.sendSystemMessage(request.eventId, 'participant_joined', request.userId);
        }
      } catch (error) {
        console.error('Ошибка отправки системного сообщения о вступлении участника:', error);
      }
    }

    // Удаляем заявку из БД после принятия
    await this.requestRepository.remove(request);

    // Создаем уведомление
    try {
      if (request.type === 'application') {
        // Если это заявка, уведомляем пользователя, который подал заявку
        await this.notificationService.createNotification({
          userId: request.userId,
          type: NotificationType.EVENT_REQUEST_ACCEPTED,
          actorId: userId, // Создатель события принял заявку
          eventId: request.eventId,
        });
      } else {
        // Если это приглашение, уведомляем создателя события
        await this.notificationService.createNotification({
          userId: request.event.creatorId,
          type: NotificationType.EVENT_REQUEST_ACCEPTED,
          actorId: request.userId, // Пользователь принял приглашение
          eventId: request.eventId,
        });
      }
    } catch (error) {
      console.error('Ошибка создания уведомления о принятии заявки на событие:', error);
    }

    // Отправляем через WebSocket
    if (this.webSocketGateway) {
      if (request.type === 'application') {
        // Если это заявка, отправляем пользователю, который подал заявку
        this.webSocketGateway.sendEventUpdateToUser(request.userId, {
          action: 'request_accepted',
          eventId: request.eventId,
        });
      } else {
        // Если это приглашение, отправляем создателю события
        this.webSocketGateway.sendEventUpdateToUser(request.event.creatorId, {
          action: 'invitation_accepted',
          eventId: request.eventId,
          userId: request.userId,
        });
      }
    }
  }

  /**
   * Отклонить заявку/приглашение
   */
  async rejectRequest(requestId: string, userId: string): Promise<void> {
    const request = await this.requestRepository.findOne({
      where: { id: requestId },
      relations: ['event']
    });

    if (!request) {
      throw new NotFoundException('Заявка не найдена');
    }

    // Проверяем права: для приглашений может отклонить только приглашенный пользователь
    // Для заявок может отклонить только создатель события
    if (request.type === 'invitation') {
      if (request.userId !== userId) {
        throw new ForbiddenException('Только приглашенный пользователь может отклонить приглашение');
      }
    } else {
      // application
      if (request.event.creatorId !== userId) {
        throw new ForbiddenException('Только создатель события может отклонить заявку');
      }
    }

    // Удаляем заявку из БД после отклонения
    await this.requestRepository.remove(request);

    // Создаем уведомление
    try {
      if (request.type === 'application') {
        // Если это заявка, уведомляем пользователя, который подал заявку
        await this.notificationService.createNotification({
          userId: request.userId,
          type: NotificationType.EVENT_REQUEST_REJECTED,
          actorId: userId, // Создатель события отклонил заявку
          eventId: request.eventId,
        });
      } else {
        // Если это приглашение, уведомляем создателя события
        await this.notificationService.createNotification({
          userId: request.event.creatorId,
          type: NotificationType.EVENT_REQUEST_REJECTED,
          actorId: request.userId, // Пользователь отклонил приглашение
          eventId: request.eventId,
        });
      }
    } catch (error) {
      console.error('Ошибка создания уведомления об отклонении заявки на событие:', error);
    }

    // Отправляем через WebSocket
    if (this.webSocketGateway) {
      if (request.type === 'application') {
        // Если это заявка, отправляем пользователю, который подал заявку
        this.webSocketGateway.sendEventUpdateToUser(request.userId, {
          action: 'request_rejected',
          eventId: request.eventId,
        });
      } else {
        // Если это приглашение, отправляем создателю события
        this.webSocketGateway.sendEventUpdateToUser(request.event.creatorId, {
          action: 'invitation_rejected',
          eventId: request.eventId,
          userId: request.userId,
        });
      }
    }
  }

  /**
   * Отменить заявку/приглашение по ID заявки
   */
  async cancelRequestById(requestId: string, currentUserId: string): Promise<void> {
    const request = await this.requestRepository.findOne({
      where: { id: requestId },
      relations: ['event']
    });

    if (!request) {
      throw new NotFoundException('Заявка не найдена');
    }

    // Проверяем права: отменить может только тот, кто отправил
    if (request.type === 'invitation') {
      // Для приглашений может отменить только создатель события
      if (!request.event || request.event.creatorId !== currentUserId) {
        throw new ForbiddenException('Только создатель события может отменить приглашение');
      }
    } else {
      // Для заявок может отменить только пользователь, который подал заявку
      if (request.userId !== currentUserId) {
        throw new ForbiddenException('Только автор заявки может ее отменить');
      }
    }

    await this.requestRepository.remove(request);
  }

  /**
   * Отменить заявку/приглашение
   */
  async cancelRequest(eventId: string, userId: string, currentUserId: string): Promise<void> {
    const request = await this.requestRepository.findOne({
      where: { eventId, userId }
    });

    if (!request) {
      throw new NotFoundException('Заявка не найдена');
    }

    // Проверяем права: отменить может только тот, кто отправил
    if (request.type === 'invitation') {
      // Для приглашений может отменить только создатель события
      const event = await this.eventRepository.findOne({ where: { id: eventId } });
      if (!event || event.creatorId !== currentUserId) {
        throw new ForbiddenException('Только создатель события может отменить приглашение');
      }
    } else {
      // Для заявок может отменить только пользователь, который подал заявку
      if (request.userId !== currentUserId) {
        throw new ForbiddenException('Только автор заявки может ее отменить');
      }
    }

    await this.requestRepository.remove(request);
  }

  /**
   * Получить входящие заявки на участие в событии (для создателя события)
   */
  async getReceivedRequests(eventId: string, userId: string): Promise<any[]> {
    const event = await this.eventRepository.findOne({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException('Событие не найдено');
    }

    if (event.creatorId !== userId) {
      throw new ForbiddenException('Только создатель события может просматривать входящие заявки');
    }

    const requests = await this.requestRepository.find({
      where: { 
        eventId, 
        type: 'application', 
        status: 'pending' 
      },
      relations: ['user'],
      order: { createdAt: 'DESC' }
    });

    console.log(`Найдено ${requests.length} входящих заявок для события ${eventId}`);

    return requests.map(request => ({
      id: request.id,
      userId: request.user.id,
      user: {
        id: request.user.id,
        email: request.user.email,
        firstName: request.user.firstName,
        lastName: request.user.lastName,
        displayName: request.user.displayName,
        avatar: request.user.avatar,
      },
      ageMatches: request.ageMatches,
      genderMatches: request.genderMatches,
      itemsCanBring: request.itemsCanBring,
      canBringMoney: request.canBringMoney,
      meetsRequirements: request.meetsRequirements,
      comment: request.comment,
      createdAt: request.createdAt
    }));
  }

  /**
   * Получить исходящие приглашения на участие в событии (от создателя события)
   */
  async getSentInvitations(eventId: string, userId: string): Promise<any[]> {
    const event = await this.eventRepository.findOne({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException('Событие не найдено');
    }

    if (event.creatorId !== userId) {
      throw new ForbiddenException('Только создатель события может просматривать исходящие приглашения');
    }

    const requests = await this.requestRepository.find({
      where: { eventId, type: 'invitation', status: 'pending' },
      relations: ['user'],
      order: { createdAt: 'DESC' }
    });

    return requests.map(request => ({
      id: request.id,
      userId: request.user.id,
      user: {
        id: request.user.id,
        firstName: request.user.firstName,
        lastName: request.user.lastName,
        displayName: request.user.displayName,
        avatar: request.user.avatar,
      },
      comment: request.comment,
      createdAt: request.createdAt
    }));
  }

  /**
   * Получить входящие приглашения для пользователя (приглашения на участие в событиях)
   */
  async getReceivedInvitations(userId: string): Promise<any[]> {
    const requests = await this.requestRepository.find({
      where: { userId, type: 'invitation', status: 'pending' },
      relations: ['event', 'event.creator', 'event.participants'],
      order: { createdAt: 'DESC' }
    });

    return requests.map(request => {
      // Проверяем, является ли пользователь участником (для скрытия адреса)
      const isParticipant = request.event.participants?.some(p => p.id === userId) || 
                           request.event.creatorId === userId;
      const shouldHideAddress = request.event.hideAddressForNonParticipants && !isParticipant;

      return {
        id: request.id,
        eventId: request.event.id,
        event: {
          id: request.event.id,
          title: request.event.title,
          description: request.event.description,
          dateTime: request.event.dateTime,
          address: shouldHideAddress ? undefined : request.event.address,
          addressComment: shouldHideAddress ? undefined : request.event.addressComment,
          latitude: shouldHideAddress ? undefined : request.event.latitude,
          longitude: shouldHideAddress ? undefined : request.event.longitude,
          entrance: shouldHideAddress ? undefined : request.event.entrance,
          floor: shouldHideAddress ? undefined : request.event.floor,
          apartment: shouldHideAddress ? undefined : request.event.apartment,
          hideAddressForNonParticipants: request.event.hideAddressForNonParticipants,
          creator: toSafeUserDto(request.event.creator),
        }
      };
    });
  }

  /**
   * Получить исходящие заявки пользователя (заявки на участие в событиях)
   */
  async getSentApplications(userId: string): Promise<any[]> {
    const requests = await this.requestRepository.find({
      where: { userId, type: 'application' },
      relations: ['event', 'event.creator', 'event.participants'],
      order: { createdAt: 'DESC' }
    });

    return requests.map(request => {
      // Проверяем, является ли пользователь участником (для скрытия адреса)
      const isParticipant = request.event.participants?.some(p => p.id === userId) || 
                           request.event.creatorId === userId;
      const shouldHideAddress = request.event.hideAddressForNonParticipants && !isParticipant;

      return {
        id: request.id,
        eventId: request.event.id,
        status: request.status,
        event: {
          id: request.event.id,
          title: request.event.title,
          description: request.event.description,
          dateTime: request.event.dateTime,
          address: shouldHideAddress ? undefined : request.event.address,
          addressComment: shouldHideAddress ? undefined : request.event.addressComment,
          latitude: shouldHideAddress ? undefined : request.event.latitude,
          longitude: shouldHideAddress ? undefined : request.event.longitude,
          entrance: shouldHideAddress ? undefined : request.event.entrance,
          floor: shouldHideAddress ? undefined : request.event.floor,
          apartment: shouldHideAddress ? undefined : request.event.apartment,
          hideAddressForNonParticipants: request.event.hideAddressForNonParticipants,
          maxParticipants: request.event.maxParticipants,
          participants: toSafeUserDtoArray(request.event.participants || []),
          creator: toSafeUserDto(request.event.creator),
        },
        comment: request.comment,
        createdAt: request.createdAt
      };
    });
  }

  /**
   * Получить список друзей для отправки приглашений
   */
  async getFriendsForInvitation(userId: string, skip: number = 0, take: number = 25, eventId?: string, search?: string): Promise<{ friends: any[]; total: number }> {
    // Используем QueryBuilder для поддержки поиска и фильтрации
    const queryBuilder = this.friendRepository
      .createQueryBuilder('friend')
      .leftJoinAndSelect('friend.friend', 'user')
      .where('friend.userId = :userId', { userId })
      .select([
        'friend.id',
        'friend.createdAt',
        'user.id',
        'user.email',
        'user.firstName',
        'user.lastName',
        'user.displayName',
        'user.avatar'
      ]);

    // Применяем поиск, если он передан
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      queryBuilder.andWhere(
        '(LOWER(user.firstName) LIKE LOWER(:search) OR LOWER(user.lastName) LIKE LOWER(:search) OR LOWER(user.displayName) LIKE LOWER(:search) OR LOWER(user.email) LIKE LOWER(:search))',
        { search: searchTerm }
      );
    }

    // Если передан eventId, исключаем уже приглашенных друзей и участников
    if (eventId) {
      // Получаем список ID уже приглашенных друзей (pending приглашения)
      const pendingInvitations = await this.requestRepository.find({
        where: { 
          eventId, 
          type: 'invitation', 
          status: 'pending' 
        },
        select: ['userId']
      });
      const invitedUserIds = pendingInvitations.map(inv => inv.userId);

      // Получаем список ID участников события
      const event = await this.eventRepository.findOne({
        where: { id: eventId },
        relations: ['participants']
      });
      const participantIds = event?.participants?.map(p => p.id) || [];

      // Объединяем исключенные ID
      const excludedIds = [...invitedUserIds, ...participantIds];

      // Исключаем уже приглашенных и участников из запроса
      if (excludedIds.length > 0) {
        queryBuilder.andWhere('user.id NOT IN (:...excludedIds)', { excludedIds });
      }
    }

    // Сортировка
    queryBuilder.orderBy('friend.createdAt', 'DESC');

    // Получаем общее количество (до пагинации)
    const total = await queryBuilder.getCount();

    // Применяем пагинацию
    queryBuilder.skip(skip).take(take);

    // Выполняем запрос
    const friends = await queryBuilder.getMany();

    return {
      friends: friends.map(friend => toSafeUserDto(friend.friend)),
      total
    };
  }
}

