import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { Chat } from './chat.entity';
import { Message } from './message.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateChatDto } from './dto/create-chat.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';

@ApiTags('chats')
@Controller('chats')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @ApiOperation({ summary: 'Создать новый чат' })
  @ApiResponse({ status: 201, description: 'Чат создан успешно' })
  async create(@Body() createChatDto: CreateChatDto, @Request() req: any): Promise<Chat> {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('Пользователь не авторизован');
    }
    return this.chatService.createChat(createChatDto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Получить список всех чатов пользователя' })
  @ApiResponse({ status: 200, description: 'Список чатов получен успешно' })
  async getUserChats(@Request() req: any): Promise<Chat[]> {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('Пользователь не авторизован');
    }
    return this.chatService.getUserChats(user.id);
  }

  @Get('event/:eventId')
  @ApiOperation({ summary: 'Получить чат события' })
  @ApiResponse({ status: 200, description: 'Чат события получен успешно' })
  async getEventChat(@Param('eventId') eventId: string, @Request() req: any): Promise<Chat | null> {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('Пользователь не авторизован');
    }
    return this.chatService.getEventChat(eventId, user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить чат по ID' })
  @ApiResponse({ status: 200, description: 'Чат получен успешно' })
  async findById(@Param('id') id: string, @Request() req: any): Promise<Chat> {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('Пользователь не авторизован');
    }
    return this.chatService.findById(id, user.id);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Получить сообщения чата' })
  @ApiResponse({ status: 200, description: 'Сообщения получены успешно' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Количество сообщений' })
  @ApiQuery({ name: 'before', required: false, type: String, description: 'Дата для пагинации' })
  async getMessages(
    @Param('id') chatId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
    @Request() req?: any,
  ): Promise<Message[]> {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('Пользователь не авторизован');
    }

    const limitNum = limit ? parseInt(limit, 10) : 50;
    const beforeDate = before ? new Date(before) : undefined;

    return this.chatService.getMessages(chatId, user.id, limitNum, beforeDate);
  }

  @Get(':id/messages/poll')
  @ApiOperation({ summary: 'Long polling для получения новых сообщений' })
  @ApiResponse({ status: 200, description: 'Новые сообщения получены' })
  @ApiQuery({ name: 'after', required: true, type: String, description: 'Дата последнего сообщения' })
  @ApiQuery({ name: 'timeout', required: false, type: Number, description: 'Таймаут в миллисекундах' })
  async pollMessages(
    @Param('id') chatId: string,
    @Query('after') after: string,
    @Query('timeout') timeout?: string,
    @Request() req?: any,
  ): Promise<Message[]> {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('Пользователь не авторизован');
    }

    const afterDate = new Date(after);
    if (isNaN(afterDate.getTime())) {
      throw new BadRequestException('Неверный формат даты');
    }

    const timeoutNum = timeout ? parseInt(timeout, 10) : 30000;

    return this.chatService.getNewMessages(chatId, user.id, afterDate, timeoutNum);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Отправить сообщение в чат' })
  @ApiResponse({ status: 201, description: 'Сообщение отправлено успешно' })
  async sendMessage(
    @Param('id') chatId: string,
    @Body() createMessageDto: CreateMessageDto,
    @Request() req: any,
  ): Promise<Message> {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('Пользователь не авторизован');
    }
    return this.chatService.sendMessage(chatId, createMessageDto, user.id);
  }

  @Patch('messages/:messageId')
  @ApiOperation({ summary: 'Редактировать сообщение' })
  @ApiResponse({ status: 200, description: 'Сообщение обновлено успешно' })
  async updateMessage(
    @Param('messageId') messageId: string,
    @Body() updateMessageDto: UpdateMessageDto,
    @Request() req: any,
  ): Promise<Message> {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('Пользователь не авторизован');
    }
    return this.chatService.updateMessage(messageId, updateMessageDto, user.id);
  }

  @Delete('messages/:messageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить сообщение' })
  @ApiResponse({ status: 204, description: 'Сообщение удалено успешно' })
  async deleteMessage(@Param('messageId') messageId: string, @Request() req: any): Promise<void> {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('Пользователь не авторизован');
    }
    return this.chatService.deleteMessage(messageId, user.id);
  }

  @Post(':id/participants')
  @ApiOperation({ summary: 'Добавить участника в чат' })
  @ApiResponse({ status: 201, description: 'Участник добавлен успешно' })
  async addParticipant(
    @Param('id') chatId: string,
    @Body('userId') userId: string,
    @Request() req: any,
  ): Promise<void> {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('Пользователь не авторизован');
    }
    return this.chatService.addParticipant(chatId, userId, user.id);
  }

  @Delete(':id/participants/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить участника из чата' })
  @ApiResponse({ status: 204, description: 'Участник удален успешно' })
  async removeParticipant(
    @Param('id') chatId: string,
    @Param('userId') userId: string,
    @Request() req: any,
  ): Promise<void> {
    const user = req.user;
    if (!user) {
      throw new BadRequestException('Пользователь не авторизован');
    }
    return this.chatService.removeParticipant(chatId, userId, user.id);
  }
}

