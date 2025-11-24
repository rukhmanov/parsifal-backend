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

    // Устанавливаем значения по умолчанию для entrance, floor, apartment
    const event = this.eventRepository.create({
      ...eventData,
      entrance: eventData.entrance ?? 1,
      floor: eventData.floor ?? 1,
      apartment: eventData.apartment ?? 1,
      creatorId,
    });
    return await this.eventRepository.save(event);
  }

  async findAll(): Promise<Event[]> {
    const now = new Date();
    return await this.eventRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.creator', 'creator')
      .leftJoinAndSelect('event.participants', 'participants')
      .where('event.dateTime >= :now', { now })
      .orderBy('event.dateTime', 'ASC')
      .getMany();
  }

  // Получение событий с фильтрацией и пагинацией
  async findAllWithFilters(request: FilterRequestDto): Promise<FilterResponseDto<Event>> {
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
    return await this.filterService.createPaginatedResponse(queryBuilder, request);
  }

  async findAllIncludingPast(): Promise<Event[]> {
    return await this.eventRepository.find({
      relations: ['creator', 'participants'],
      order: { dateTime: 'ASC' }
    });
  }

  async findUserEvents(userId: string, includePast: boolean = false): Promise<Event[]> {
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

    return await queryBuilder.getMany();
  }

  async findById(id: string): Promise<Event | null> {
    return await this.eventRepository.findOne({
      where: { id },
      relations: ['creator', 'participants']
    });
  }

  async update(id: string, eventData: UpdateEventDto): Promise<Event | null> {
    await this.eventRepository.update(id, eventData);
    return await this.findById(id);
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

  async addParticipant(eventId: string, userId: string): Promise<Event | null> {
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
    return await this.eventRepository.save(event);
  }

  async removeParticipant(eventId: string, userId: string): Promise<Event | null> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
      relations: ['participants']
    });

    if (!event) {
      return null;
    }

    event.participants = event.participants.filter(p => p.id !== userId);
    const savedEvent = await this.eventRepository.save(event);

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

    return savedEvent;
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

    return event.participants.map(participant => ({
      id: participant.id,
      email: participant.email,
      firstName: participant.firstName,
      lastName: participant.lastName,
      displayName: participant.displayName,
      avatar: participant.avatar,
    }));
  }
}

