import { Injectable, BadRequestException, NotFoundException, ForbiddenException, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThan, Not } from 'typeorm';
import { Chat, ChatType } from './chat.entity';
import { Message } from './message.entity';
import { ChatParticipant } from './chat-participant.entity';
import { User } from '../user/user.entity';
import { Event } from '../event/event.entity';
import { CreateChatDto } from './dto/create-chat.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.entity';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Chat)
    private readonly chatRepository: Repository<Chat>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(ChatParticipant)
    private readonly chatParticipantRepository: Repository<ChatParticipant>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService: NotificationService,
    @Inject(forwardRef(() => AppWebSocketGateway))
    private readonly webSocketGateway?: AppWebSocketGateway,
  ) {}

  /**
   * Очищает content удаленных сообщений для безопасности
   */
  private sanitizeDeletedMessage(message: Message): Message {
    if (message.isDeleted) {
      message.content = '';
    }
    return message;
  }

  /**
   * Очищает content удаленных сообщений в массиве
   */
  private sanitizeDeletedMessages(messages: Message[]): Message[] {
    return messages.map(msg => this.sanitizeDeletedMessage(msg));
  }

  async createChat(createChatDto: CreateChatDto, creatorId: string): Promise<Chat> {
    // Проверяем, что все участники существуют
    const participants = await this.userRepository.find({
      where: { id: In(createChatDto.participantIds) },
    });

    if (participants.length !== createChatDto.participantIds.length) {
      throw new BadRequestException('Один или несколько участников не найдены');
    }

    // Добавляем создателя в список участников, если его там нет
    const allParticipantIds = [...new Set([creatorId, ...createChatDto.participantIds])];

    // Для личных чатов проверяем, не существует ли уже такой чат
    if (createChatDto.type === ChatType.USER && allParticipantIds.length === 2) {
      const existingChat = await this.findUserChat(allParticipantIds[0], allParticipantIds[1]);
      if (existingChat) {
        return existingChat;
      }
    }

    // Для чатов событий проверяем, что событие существует и у него еще нет чата
    if (createChatDto.type === ChatType.EVENT) {
      if (!createChatDto.eventId) {
        throw new BadRequestException('eventId обязателен для чата события');
      }

      const event = await this.eventRepository.findOne({
        where: { id: createChatDto.eventId },
        relations: ['participants'],
      });

      if (!event) {
        throw new NotFoundException('Событие не найдено');
      }

      // Проверяем, не существует ли уже чат для этого события
      const existingEventChat = await this.chatRepository.findOne({
        where: { type: ChatType.EVENT, eventId: createChatDto.eventId },
      });

      if (existingEventChat) {
        // Добавляем участников, если их еще нет
        await this.addParticipantsToChat(existingEventChat.id, allParticipantIds);
        return await this.findById(existingEventChat.id, creatorId);
      }

      // Создаем чат события
      const chat = this.chatRepository.create({
        type: ChatType.EVENT,
        eventId: createChatDto.eventId,
      });
      const savedChat = await this.chatRepository.save(chat);

      // Добавляем всех участников события в чат
      const eventParticipantIds = [
        event.creatorId,
        ...(event.participants?.map(p => p.id) || []),
      ];
      await this.addParticipantsToChat(savedChat.id, [...new Set(eventParticipantIds)]);

      return await this.findById(savedChat.id, creatorId);
    }

    // Создаем личный чат
    const chat = this.chatRepository.create({
      type: ChatType.USER,
    });
    const savedChat = await this.chatRepository.save(chat);

    // Добавляем участников
    await this.addParticipantsToChat(savedChat.id, allParticipantIds);

    return await this.findById(savedChat.id, creatorId);
  }

  private async addParticipantsToChat(chatId: string, userIds: string[]): Promise<void> {
    const existingParticipants = await this.chatParticipantRepository.find({
      where: { chatId, userId: In(userIds) },
    });

    const existingUserIds = existingParticipants.map(p => p.userId);
    const newUserIds = userIds.filter(id => !existingUserIds.includes(id));

    if (newUserIds.length > 0) {
      const newParticipants = newUserIds.map(userId =>
        this.chatParticipantRepository.create({ chatId, userId }),
      );
      await this.chatParticipantRepository.save(newParticipants);
    }
  }

  async findUserChat(userId1: string, userId2: string): Promise<Chat | null> {
    const chats = await this.chatRepository
      .createQueryBuilder('chat')
      .innerJoin('chat.participants', 'p1', 'p1.userId = :userId1', { userId1 })
      .innerJoin('chat.participants', 'p2', 'p2.userId = :userId2', { userId2 })
      .where('chat.type = :type', { type: ChatType.USER })
      .andWhere(
        '(SELECT COUNT(*) FROM chat_participants WHERE "chatId" = chat.id) = 2',
      )
      .getOne();

    return chats || null;
  }

  async findById(chatId: string, userId: string): Promise<Chat> {
    const chat = await this.chatRepository.findOne({
      where: { id: chatId },
      relations: ['event', 'participants', 'participants.user'],
    });

    if (!chat) {
      throw new NotFoundException('Чат не найден');
    }

    // Проверяем, является ли пользователь участником чата
    const isParticipant = chat.participants.some(p => p.userId === userId);
    if (!isParticipant) {
      throw new ForbiddenException('У вас нет доступа к этому чату');
    }

    // Преобразуем participants из ChatParticipant[] в User[]
    if (chat.participants && Array.isArray(chat.participants)) {
      (chat as any).participants = chat.participants
        .map((p: ChatParticipant) => p.user)
        .filter((user: User) => user !== null && user !== undefined);
    }

    return chat;
  }

  async getUserChats(userId: string): Promise<Chat[]> {
    const participantChats = await this.chatParticipantRepository.find({
      where: { userId },
      relations: ['chat', 'chat.event', 'chat.participants', 'chat.participants.user'],
    });

    const chats = participantChats.map(p => p.chat);

    // Преобразуем участников из ChatParticipant в User для каждого чата
    for (const chat of chats) {
      // Находим ChatParticipant для текущего пользователя
      const participant = participantChats.find(p => p.chatId === chat.id && p.userId === userId);
      const lastReadAt = participant?.lastReadAt || null;

      // Преобразуем participants из ChatParticipant[] в User[]
      if (chat.participants && Array.isArray(chat.participants)) {
        (chat as any).participants = chat.participants
          .map((p: ChatParticipant) => p.user)
          .filter((user: User) => user !== null && user !== undefined);
      }

      // Получаем последнее сообщение для каждого чата
      const lastMessage = await this.messageRepository.findOne({
        where: { chatId: chat.id, isDeleted: false },
        relations: ['sender'],
        order: { createdAt: 'DESC' },
      });
      (chat as any).lastMessage = lastMessage ? this.sanitizeDeletedMessage(lastMessage) : null;

      // Подсчитываем непрочитанные сообщения
      let unreadCount = 0;
      if (lastReadAt && lastMessage) {
        // Если есть lastReadAt и есть сообщения, считаем непрочитанные
        unreadCount = await this.messageRepository.count({
          where: {
            chatId: chat.id,
            isDeleted: false,
            createdAt: MoreThan(lastReadAt),
            senderId: Not(userId), // Сообщения не от текущего пользователя
          },
        });
      } else if (!lastReadAt && lastMessage) {
        // Если нет lastReadAt, но есть сообщения, считаем все сообщения не от пользователя
        unreadCount = await this.messageRepository.count({
          where: {
            chatId: chat.id,
            isDeleted: false,
            senderId: Not(userId),
          },
        });
      }
      (chat as any).unreadCount = unreadCount;
    }

    // Сортируем по дате последнего сообщения
    chats.sort((a, b) => {
      const aDate = (a as any).lastMessage?.createdAt || a.createdAt;
      const bDate = (b as any).lastMessage?.createdAt || b.createdAt;
      return bDate.getTime() - aDate.getTime();
    });

    return chats;
  }

  async getEventChat(eventId: string, userId: string): Promise<Chat | null> {
    const chat = await this.chatRepository.findOne({
      where: { type: ChatType.EVENT, eventId },
      relations: ['event', 'participants', 'participants.user'],
    });

    if (!chat) {
      return null;
    }

    // Проверяем, является ли пользователь участником чата
    const isParticipant = chat.participants.some(p => p.userId === userId);
    if (!isParticipant) {
      throw new ForbiddenException('У вас нет доступа к этому чату');
    }

    // Преобразуем participants из ChatParticipant[] в User[]
    if (chat.participants && Array.isArray(chat.participants)) {
      (chat as any).participants = chat.participants
        .map((p: ChatParticipant) => p.user)
        .filter((user: User) => user !== null && user !== undefined);
    }

    return chat;
  }

  async sendMessage(
    chatId: string,
    createMessageDto: CreateMessageDto,
    senderId: string,
  ): Promise<Message> {
    // Проверяем, что чат существует и пользователь является участником
    await this.findById(chatId, senderId);

    const message = this.messageRepository.create({
      chatId,
      senderId,
      content: createMessageDto.content,
    });

    const savedMessage = await this.messageRepository.save(message);
    
    // Загружаем сообщение с relation sender для корректного отображения
    const messageWithSender = await this.messageRepository.findOne({
      where: { id: savedMessage.id },
      relations: ['sender'],
    });

    // Получаем всех участников чата для создания уведомлений
    const participants = await this.chatParticipantRepository.find({
      where: { chatId },
      relations: ['user'],
    });

    // Создаем уведомления для всех участников чата, кроме отправителя
    try {
      const notificationPromises = participants
        .filter(p => p.userId !== senderId)
        .map(participant =>
          this.notificationService.createNotification({
            userId: participant.userId,
            type: NotificationType.MESSAGE_RECEIVED,
            actorId: senderId,
            chatId: chatId,
          })
        );
      
      await Promise.all(notificationPromises);
    } catch (error) {
      console.error('Ошибка создания уведомлений о сообщении:', error);
      // Не прерываем выполнение, если уведомления не создались
    }

    // Отправляем сообщение через WebSocket всем участникам чата, кроме отправителя
    if (this.webSocketGateway && messageWithSender) {
      const messageData = this.sanitizeDeletedMessage(messageWithSender);
      participants
        .filter(p => p.userId !== senderId)
        .forEach(participant => {
          if (this.webSocketGateway) {
            this.webSocketGateway.sendChatMessageToUser(participant.userId, {
              action: 'message_received',
              chatId: chatId,
              message: messageData,
            });
          }
        });
    }

    const messageToReturn = messageWithSender || savedMessage;
    return this.sanitizeDeletedMessage(messageToReturn);
  }

  async getMessages(
    chatId: string,
    userId: string,
    limit: number = 50,
    before?: Date,
  ): Promise<Message[]> {
    // Проверяем доступ
    await this.findById(chatId, userId);

    const queryBuilder = this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .where('message.chatId = :chatId', { chatId })
      .orderBy('message.createdAt', 'DESC')
      .limit(limit);

    if (before) {
      queryBuilder.andWhere('message.createdAt < :before', { before });
    }

    const messages = await queryBuilder.getMany();

    // Обновляем время последнего прочтения
    await this.chatParticipantRepository.update(
      { chatId, userId },
      { lastReadAt: new Date() },
    );

    const reversedMessages = messages.reverse(); // Возвращаем в хронологическом порядке
    return this.sanitizeDeletedMessages(reversedMessages);
  }

  async getNewMessages(
    chatId: string,
    userId: string,
    after: Date,
    timeout: number = 30000, // 30 секунд по умолчанию
  ): Promise<Message[]> {
    // Проверяем доступ
    await this.findById(chatId, userId);

    const startTime = Date.now();
    const endTime = startTime + timeout;

    // Long polling: ждем новые сообщения
    while (Date.now() < endTime) {
      const messages = await this.messageRepository.find({
        where: {
          chatId,
          createdAt: MoreThan(after),
        },
        relations: ['sender'],
        order: { createdAt: 'ASC' },
      });

      if (messages.length > 0) {
        // Обновляем время последнего прочтения
        await this.chatParticipantRepository.update(
          { chatId, userId },
          { lastReadAt: new Date() },
        );
        return this.sanitizeDeletedMessages(messages);
      }

      // Ждем 1 секунду перед следующей проверкой
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Если новых сообщений нет, возвращаем пустой массив
    return [];
  }

  async updateMessage(
    messageId: string,
    updateMessageDto: UpdateMessageDto,
    userId: string,
  ): Promise<Message> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['chat'],
    });

    if (!message) {
      throw new NotFoundException('Сообщение не найдено');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('Вы можете редактировать только свои сообщения');
    }

    message.content = updateMessageDto.content;
    message.isEdited = true;

    const savedMessage = await this.messageRepository.save(message);
    return this.sanitizeDeletedMessage(savedMessage);
  }

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Сообщение не найдено');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('Вы можете удалять только свои сообщения');
    }

    message.isDeleted = true;
    await this.messageRepository.save(message);
  }

  /**
   * Пометить чат как прочитанный
   */
  async markChatAsRead(chatId: string, userId: string): Promise<void> {
    // Проверяем доступ
    await this.findById(chatId, userId);

    // Обновляем lastReadAt для участника
    await this.chatParticipantRepository.update(
      { chatId, userId },
      { lastReadAt: new Date() },
    );
  }

  async addParticipant(chatId: string, userId: string, currentUserId: string): Promise<void> {
    await this.findById(chatId, currentUserId);

    // Проверяем, что пользователь еще не является участником
    const existingParticipant = await this.chatParticipantRepository.findOne({
      where: { chatId, userId },
    });

    if (existingParticipant) {
      throw new BadRequestException('Пользователь уже является участником чата');
    }

    const participant = this.chatParticipantRepository.create({ chatId, userId });
    await this.chatParticipantRepository.save(participant);
  }

  async removeParticipant(chatId: string, userId: string, currentUserId: string): Promise<void> {
    // Пользователь может удалить только себя (или быть админом)
    if (userId !== currentUserId) {
      throw new ForbiddenException('Вы можете удалить только себя из чата');
    }

    await this.chatParticipantRepository.delete({ chatId, userId });
  }

  /**
   * Удалить чат
   * Для личных чатов (USER) между 2 людьми - удаляет чат для обоих участников
   * Для чатов событий (EVENT) - запрещает удаление пользователем
   */
  async deleteChat(chatId: string, userId: string): Promise<void> {
    // Получаем чат с информацией о типе
    const chat = await this.chatRepository.findOne({
      where: { id: chatId },
      relations: ['participants'],
    });

    if (!chat) {
      throw new NotFoundException('Чат не найден');
    }

    // Проверяем доступ
    await this.findById(chatId, userId);

    // Если это чат события, запрещаем удаление пользователем
    if (chat.type === ChatType.EVENT) {
      throw new ForbiddenException('Чат события нельзя удалить. Он будет удален вместе с событием.');
    }

    // Для личных чатов (USER) удаляем всех участников и сам чат
    if (chat.type === ChatType.USER) {
      // Удаляем всех участников из чата
      await this.chatParticipantRepository.delete({ chatId });

      // Удаляем все сообщения
      await this.messageRepository.delete({ chatId });

      // Удаляем сам чат
      await this.chatRepository.delete({ id: chatId });
    }
  }
}

