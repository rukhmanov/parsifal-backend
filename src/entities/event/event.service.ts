import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from './event.entity';
import { User } from '../user/user.entity';

export interface CreateEventDto {
  title: string;
  description?: string;
  dateTime: Date;
  itemsToBring?: string[];
  moneyRequired?: number;
  latitude?: number;
  longitude?: number;
  address?: string;
  maxParticipants?: number;
  minAge?: number;
  maxAge?: number;
  preferredGender?: 'male' | 'female' | 'any';
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
  maxParticipants?: number;
  minAge?: number;
  maxAge?: number;
  preferredGender?: 'male' | 'female' | 'any';
}

@Injectable()
export class EventService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(eventData: CreateEventDto, creatorId: string): Promise<Event> {
    const event = this.eventRepository.create({
      ...eventData,
      creatorId,
    });
    return await this.eventRepository.save(event);
  }

  async findAll(): Promise<Event[]> {
    return await this.eventRepository.find({
      relations: ['creator', 'participants'],
      order: { dateTime: 'ASC' }
    });
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
    return await this.eventRepository.save(event);
  }
}

