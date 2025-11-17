import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventParticipationRequest } from './event-participation-request.entity';
import { Event } from '../event/event.entity';
import { User } from '../user/user.entity';
import { Friend } from '../friend/friend.entity';

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
  ) {}

  /**
   * Отправить приглашение на участие в событии (от создателя события)
   */
  async sendInvitation(eventId: string, userId: string, creatorId: string): Promise<EventParticipationRequest> {
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
      type: 'invitation'
    });

    return await this.requestRepository.save(request);
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
      meetsRequirements: requirementsData?.meetsRequirements ?? false
    });

    return await this.requestRepository.save(request);
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
    }

    // Удаляем заявку из БД после принятия
    await this.requestRepository.remove(request);
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
        email: request.user.email,
        firstName: request.user.firstName,
        lastName: request.user.lastName,
        displayName: request.user.displayName,
        avatar: request.user.avatar,
      },
      createdAt: request.createdAt
    }));
  }

  /**
   * Получить входящие приглашения для пользователя (приглашения на участие в событиях)
   */
  async getReceivedInvitations(userId: string): Promise<any[]> {
    const requests = await this.requestRepository.find({
      where: { userId, type: 'invitation', status: 'pending' },
      relations: ['event', 'event.creator'],
      order: { createdAt: 'DESC' }
    });

    return requests.map(request => ({
      id: request.id,
      eventId: request.event.id,
      event: {
        id: request.event.id,
        title: request.event.title,
        description: request.event.description,
        dateTime: request.event.dateTime,
        address: request.event.address,
        creator: {
          id: request.event.creator.id,
          firstName: request.event.creator.firstName,
          lastName: request.event.creator.lastName,
          displayName: request.event.creator.displayName,
          avatar: request.event.creator.avatar,
        }
      },
      createdAt: request.createdAt
    }));
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

    return requests.map(request => ({
      id: request.id,
      eventId: request.event.id,
      status: request.status,
      event: {
        id: request.event.id,
        title: request.event.title,
        description: request.event.description,
        dateTime: request.event.dateTime,
        address: request.event.address,
        maxParticipants: request.event.maxParticipants,
        participants: request.event.participants?.map(p => ({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          displayName: p.displayName,
          avatar: p.avatar,
        })) || [],
        creator: {
          id: request.event.creator.id,
          firstName: request.event.creator.firstName,
          lastName: request.event.creator.lastName,
          displayName: request.event.creator.displayName,
          avatar: request.event.creator.avatar,
        }
      },
      createdAt: request.createdAt
    }));
  }

  /**
   * Получить список друзей для отправки приглашений
   */
  async getFriendsForInvitation(userId: string): Promise<any[]> {
    const friends = await this.friendRepository.find({
      where: { userId },
      relations: ['friend'],
      order: { createdAt: 'DESC' }
    });

    return friends.map(friend => ({
      id: friend.friend.id,
      email: friend.friend.email,
      firstName: friend.friend.firstName,
      lastName: friend.friend.lastName,
      displayName: friend.friend.displayName,
      avatar: friend.friend.avatar,
    }));
  }
}

