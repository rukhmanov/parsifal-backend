import { Injectable, BadRequestException, NotFoundException, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from './event.entity';
import { User } from '../user/user.entity';
import { FilterService } from '../../common/services/filter.service';
import { ProfanityFilterService } from '../../common/services/profanity-filter.service';
import { FilterRequestDto, FilterResponseDto } from '../../common/dto/filter.dto';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.entity';
import { ChatService } from '../chat/chat.service';
import { toSafeUserDto, toSafeUserDtoArray } from '../../common/dto/safe-user.dto';

export interface CreateEventDto {
  title: string;
  description?: string;
  dateTime: Date;
  itemsToBring?: string[];
  moneyRequired?: number;
  latitude?: number;
  longitude?: number;
  address?: string;
  addressComment?: string;
  hideAddressForNonParticipants?: boolean;
  entrance?: number;
  floor?: number;
  apartment?: number;
  maxParticipants?: number;
  minAge?: number;
  maxAge?: number;
  preferredGender?: 'male' | 'female' | 'any';
  coverImage?: string;
  duration?: number;
}

export interface UpdateEventDto {
  title?: string;
  description?: string;
  dateTime?: Date;
  itemsToBring?: string[];
  moneyRequired?: number;
  latitude?: number;
  longitude?: number;
  address?: string;
  addressComment?: string;
  hideAddressForNonParticipants?: boolean;
  entrance?: number;
  floor?: number;
  apartment?: number;
  maxParticipants?: number;
  minAge?: number;
  maxAge?: number;
  preferredGender?: 'male' | 'female' | 'any';
  coverImage?: string;
  duration?: number;
}

@Injectable()
export class EventService {
  // Конфигурация полей для фильтрации событий
  private readonly eventFilterFields = [
    { key: 'title', type: 'string' as const, searchable: true, sortable: true },
    { key: 'description', type: 'string' as const, searchable: true, sortable: false },
    { key: 'address', type: 'string' as const, searchable: true, sortable: false },
    { key: 'dateTime', type: 'date' as const, searchable: false, sortable: true, isRangeFilter: true },
    { key: 'maxParticipants', type: 'number' as const, searchable: false, sortable: true },
    { key: 'duration', type: 'number' as const, searchable: false, sortable: true },
    { key: 'createdAt', type: 'date' as const, searchable: false, sortable: true, isRangeFilter: true },
  ];

  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly filterService: FilterService,
    private readonly profanityFilterService: ProfanityFilterService,
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService: NotificationService,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService?: ChatService,
  ) {}

  async create(eventData: CreateEventDto, creatorId: string): Promise<Event> {
    // Проверяем на нецензурные слова
    if (eventData.title && this.profanityFilterService.containsProfanity(eventData.title)) {
      throw new BadRequestException('Название события содержит нецензурные слова');
    }
    if (eventData.description && this.profanityFilterService.containsProfanity(eventData.description)) {
      throw new BadRequestException('Описание события содержит нецензурные слова');
    }
    if (eventData.address && this.profanityFilterService.containsProfanity(eventData.address)) {
      throw new BadRequestException('Адрес содержит нецензурные слова');
    }
    if (eventData.addressComment && this.profanityFilterService.containsProfanity(eventData.addressComment)) {
      throw new BadRequestException('Комментарий к адресу содержит нецензурные слова');
    }

    // Проверяем количество активных событий пользователя
    const userEvents = await this.findUserEvents(creatorId, false); // false = только будущие события
    if (userEvents.length >= 3) {
      throw new BadRequestException('Вы не можете создать больше трех событий одновременно. Удалите одно из существующих событий, чтобы создать новое.');
    }

    // Устанавливаем значения по умолчанию для entrance, floor, apartment, hideAddressForNonParticipants
    const event = this.eventRepository.create({
      ...eventData,
      entrance: eventData.entrance ?? 1,
      floor: eventData.floor ?? 1,
      apartment: eventData.apartment ?? 1,
      hideAddressForNonParticipants: eventData.hideAddressForNonParticipants ?? false,
      creatorId,
    });
    const savedEvent = await this.eventRepository.save(event);
    // Загружаем с relations для безопасного преобразования
    return await this.findById(savedEvent.id, creatorId);
  }

  async findAll(requestingUserId?: string): Promise<any[]> {
    const now = new Date();
    const events = await this.eventRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.creator', 'creator')
      .leftJoinAndSelect('event.participants', 'participants')
      .where('event.dateTime >= :now', { now })
      .orderBy('event.dateTime', 'ASC')
      .getMany();
    return this.toSafeEventDtoArray(events, requestingUserId);
  }

  // Получение событий с фильтрацией и пагинацией
  async findAllWithFilters(request: FilterRequestDto, requestingUserId?: string): Promise<FilterResponseDto<any>> {
    const now = new Date();
    const queryBuilder = this.eventRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.creator', 'creator')
      .leftJoinAndSelect('event.participants', 'participants')
      .where('event.dateTime >= :now', { now });

    // Применяем фильтрацию
    this.filterService.applyFilters(queryBuilder, request, this.eventFilterFields, 'event');

    // Если сортировка не указана, используем сортировку по дате по умолчанию
    if (!request.sort) {
      queryBuilder.orderBy('event.dateTime', 'ASC');
    }

    // Создаем ответ с пагинацией
    const response = await this.filterService.createPaginatedResponse(queryBuilder, request);
    
    // Преобразуем данные в безопасный формат
    return {
      ...response,
      data: this.toSafeEventDtoArray(response.data, requestingUserId),
    };
  }

  async findAllIncludingPast(requestingUserId?: string): Promise<any[]> {
    const events = await this.eventRepository.find({
      relations: ['creator', 'participants'],
      order: { dateTime: 'ASC' }
    });
    return this.toSafeEventDtoArray(events, requestingUserId);
  }

  async findUserEvents(userId: string, includePast: boolean = false, requestingUserId?: string): Promise<any[]> {
    const queryBuilder = this.eventRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.creator', 'creator')
      .leftJoinAndSelect('event.participants', 'participants')
      .where('event.creatorId = :userId', { userId });

    if (includePast) {
      // Для завершенных событий: только прошедшие
      queryBuilder.andWhere('event.dateTime < :now', { now: new Date() });
      queryBuilder.orderBy('event.dateTime', 'DESC'); // Сначала самые недавние
    } else {
      // Для текущих событий: только будущие
      queryBuilder.andWhere('event.dateTime >= :now', { now: new Date() });
      queryBuilder.orderBy('event.dateTime', 'ASC'); // Сначала ближайшие
    }

    const events = await queryBuilder.getMany();
    return this.toSafeEventDtoArray(events, requestingUserId || userId);
  }

  /**
   * Получить события, где пользователь является участником (не организатором)
   * @param userId ID пользователя
   * @param includePast Включать ли прошедшие события
   */
  async findEventsWhereUserIsParticipant(userId: string, includePast: boolean = false, requestingUserId?: string): Promise<any[]> {
    const queryBuilder = this.eventRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.creator', 'creator')
      .leftJoinAndSelect('event.participants', 'participants')
      .innerJoin('event_participants', 'ep', 'ep.eventId = event.id AND ep.userId = :userId', { userId })
      .where('event.creatorId != :userId', { userId }); // Исключаем события, где пользователь организатор

    if (includePast) {
      // Для завершенных событий: только прошедшие
      queryBuilder.andWhere('event.dateTime < :now', { now: new Date() });
      queryBuilder.orderBy('event.dateTime', 'DESC'); // Сначала самые недавние
    } else {
      // Для текущих событий: только будущие
      queryBuilder.andWhere('event.dateTime >= :now', { now: new Date() });
      queryBuilder.orderBy('event.dateTime', 'ASC'); // Сначала ближайшие
    }

    const events = await queryBuilder.getMany();
    return this.toSafeEventDtoArray(events, requestingUserId || userId);
  }

  /**
   * Преобразует Event в безопасный формат для возврата клиенту
   * Убирает чувствительные поля из creator и participants
   * Скрывает адрес, если пользователь не участник и hideAddressForNonParticipants = true
   */
  private toSafeEventDto(event: Event | null, requestingUserId?: string): any {
    if (!event) {
      return null;
    }

    // Проверяем, является ли пользователь участником или создателем
    const isParticipant = requestingUserId && (
      event.participants?.some(p => p.id === requestingUserId) ||
      event.creatorId === requestingUserId
    );

    // Определяем, нужно ли скрывать адрес
    const shouldHideAddress = event.hideAddressForNonParticipants && !isParticipant;

    return {
      id: event.id,
      title: event.title,
      description: event.description,
      dateTime: event.dateTime,
      itemsToBring: event.itemsToBring,
      moneyRequired: event.moneyRequired,
      latitude: shouldHideAddress ? undefined : event.latitude,
      longitude: shouldHideAddress ? undefined : event.longitude,
      address: shouldHideAddress ? undefined : event.address,
      addressComment: shouldHideAddress ? undefined : event.addressComment,
      hideAddressForNonParticipants: event.hideAddressForNonParticipants,
      entrance: shouldHideAddress ? undefined : event.entrance,
      floor: shouldHideAddress ? undefined : event.floor,
      apartment: shouldHideAddress ? undefined : event.apartment,
      maxParticipants: event.maxParticipants,
      minAge: event.minAge,
      maxAge: event.maxAge,
      preferredGender: event.preferredGender,
      coverImage: event.coverImage,
      duration: event.duration,
      creatorId: event.creatorId,
      creator: event.creator ? toSafeUserDto(event.creator) : undefined,
      participants: event.participants ? toSafeUserDtoArray(event.participants) : undefined,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }

  /**
   * Преобразует массив Event в массив безопасных DTO
   */
  private toSafeEventDtoArray(events: Event[], requestingUserId?: string): any[] {
    if (!events || !Array.isArray(events)) {
      return [];
    }
    return events.map(event => this.toSafeEventDto(event, requestingUserId));
  }

  async findById(id: string, requestingUserId?: string): Promise<any | null> {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: ['creator', 'participants']
    });
    return this.toSafeEventDto(event, requestingUserId);
  }

  async update(id: string, eventData: UpdateEventDto, requestingUserId?: string): Promise<any | null> {
    await this.eventRepository.update(id, eventData);
    return await this.findById(id, requestingUserId);
  }

  async delete(id: string): Promise<void> {
    await this.eventRepository.delete(id);
  }

  /**
   * Удалить все события пользователя
   * @param userId ID пользователя
   */
  async deleteUserEvents(userId: string): Promise<void> {
    await this.eventRepository.delete({ creatorId: userId });
  }

  async addParticipant(eventId: string, userId: string, requestingUserId?: string): Promise<any | null> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
      relations: ['participants']
    });

    if (!event) {
      return null;
    }

    // Проверяем, не превышает ли количество участников максимум
    if (event.maxParticipants && event.participants.length >= event.maxParticipants) {
      throw new BadRequestException('Достигнуто максимальное количество участников');
    }

    // Проверяем, не является ли пользователь уже участником
    const isAlreadyParticipant = event.participants.some(p => p.id === userId);
    if (isAlreadyParticipant) {
      return event;
    }

    // Загружаем пользователя
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }

    // Добавляем участника
    event.participants.push(user);
    const savedEvent = await this.eventRepository.save(event);
    // Загружаем с relations для безопасного преобразования
    return await this.findById(savedEvent.id, requestingUserId || userId);
  }

  async removeParticipant(eventId: string, userId: string, removedByCreator: boolean = false, requestingUserId?: string): Promise<any | null> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
      relations: ['participants']
    });

    if (!event) {
      return null;
    }

    event.participants = event.participants.filter(p => p.id !== userId);
    await this.eventRepository.save(event);

    // Создаем уведомление для удаленного участника
    try {
      await this.notificationService.createNotification({
        userId: userId,
        type: NotificationType.EVENT_PARTICIPANT_REMOVED,
        eventId: eventId,
      });
    } catch (error) {
      console.error('Ошибка создания уведомления об удалении из события:', error);
    }

    // Отправляем системное сообщение в чат события
    try {
      if (this.chatService) {
        const systemType = removedByCreator ? 'participant_removed' : 'participant_left';
        await this.chatService.sendSystemMessage(eventId, systemType, userId);
      }
    } catch (error) {
      console.error('Ошибка отправки системного сообщения о выходе участника:', error);
    }

    // Загружаем с relations для безопасного преобразования
    return await this.findById(eventId, requestingUserId);
  }

  /**
   * Получить список участников события
   */
  async getParticipants(eventId: string): Promise<any[]> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
      relations: ['participants']
    });

    if (!event) {
      throw new NotFoundException('Событие не найдено');
    }

    return toSafeUserDtoArray(event.participants);
  }
}

