import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, In } from 'typeorm';
import { ChatService } from '../chat/chat.service';
import { FriendRequest } from '../friend-request/friend-request.entity';
import { EventParticipationRequest } from '../event-participation-request/event-participation-request.entity';
import { Event } from '../event/event.entity';

export interface PollingResponse {
  chats: any[];
  incomingFriendRequests: any[];
  incomingEventRequests: any[];
  notifications: any[];
}

@Injectable()
export class PollingService {
  constructor(
    private readonly chatService: ChatService,
    @InjectRepository(FriendRequest)
    private readonly friendRequestRepository: Repository<FriendRequest>,
    @InjectRepository(EventParticipationRequest)
    private readonly eventParticipationRequestRepository: Repository<EventParticipationRequest>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
  ) {}

  async getPollingData(userId: string): Promise<PollingResponse> {
    // Получаем чаты пользователя
    const chats = await this.chatService.getUserChats(userId);

    // Получаем входящие заявки в друзья
    const incomingFriendRequests = await this.getIncomingFriendRequests(userId);

    // Получаем входящие заявки на активные события
    const incomingEventRequests = await this.getIncomingEventRequests(userId);

    // Оповещения (пока пустой массив, структура будет определена позже)
    const notifications: any[] = [];

    return {
      chats,
      incomingFriendRequests,
      incomingEventRequests,
      notifications,
    };
  }

  private async getIncomingFriendRequests(userId: string): Promise<any[]> {
    const requests = await this.friendRequestRepository.find({
      where: { receiverId: userId },
      relations: ['sender'],
      order: { createdAt: 'DESC' },
    });

    return requests.map(request => ({
      id: request.id,
      userId: request.sender.id,
      user: {
        id: request.sender.id,
        email: request.sender.email,
        firstName: request.sender.firstName,
        lastName: request.sender.lastName,
        displayName: request.sender.displayName,
        avatar: request.sender.avatar,
      },
      createdAt: request.createdAt,
    }));
  }

  private async getIncomingEventRequests(userId: string): Promise<any[]> {
    // Получаем все активные события, где пользователь является создателем
    const now = new Date();
    const activeEvents = await this.eventRepository.find({
      where: {
        creatorId: userId,
        dateTime: MoreThan(now),
      },
      select: ['id'],
    });

    if (activeEvents.length === 0) {
      return [];
    }

    const eventIds = activeEvents.map(e => e.id);

    // Получаем входящие заявки на эти события
    const requests = await this.eventParticipationRequestRepository.find({
      where: {
        eventId: In(eventIds),
        type: 'application',
        status: 'pending',
      },
      relations: ['user', 'event'],
      order: { createdAt: 'DESC' },
    });

    return requests.map(request => ({
      id: request.id,
      eventId: request.eventId,
      event: {
        id: request.event.id,
        title: request.event.title,
      },
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
      createdAt: request.createdAt,
    }));
  }
}

