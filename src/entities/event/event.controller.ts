import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request, ForbiddenException, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { EventService, CreateEventDto, UpdateEventDto } from './event.service';
import { Event } from './event.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('events')
@Controller('events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Post()
  @ApiOperation({ summary: 'Создать новое событие' })
  @ApiResponse({ status: 201, description: 'Событие создано успешно' })
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  async create(@Body() eventData: CreateEventDto, @Request() req: any): Promise<Event> {
    const user = req.user;
    if (!user) {
      throw new ForbiddenException('Пользователь не авторизован');
    }
    return this.eventService.create(eventData, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Получить список всех событий (только будущие)' })
  @ApiResponse({ status: 200, description: 'Список событий получен успешно' })
  async findAll(): Promise<Event[]> {
    return this.eventService.findAll();
  }

  @Get('my-events')
  @ApiOperation({ summary: 'Получить события текущего пользователя' })
  @ApiResponse({ status: 200, description: 'Список событий пользователя получен успешно' })
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  async getMyEvents(
    @Request() req: any,
    @Query('includePast') includePast?: string
  ): Promise<Event[]> {
    const user = req.user;
    if (!user) {
      throw new ForbiddenException('Пользователь не авторизован');
    }
    const includePastBool = includePast === 'true';
    return this.eventService.findUserEvents(user.id, includePastBool);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить событие по ID' })
  @ApiResponse({ status: 200, description: 'Событие получено успешно' })
  async findById(@Param('id') id: string): Promise<Event | null> {
    return this.eventService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить событие' })
  @ApiResponse({ status: 200, description: 'Событие обновлено успешно' })
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() eventData: UpdateEventDto,
    @Request() req: any
  ): Promise<Event | null> {
    const user = req.user;
    if (!user) {
      throw new ForbiddenException('Пользователь не авторизован');
    }

    const event = await this.eventService.findById(id);
    if (!event) {
      throw new ForbiddenException('Событие не найдено');
    }

    // Проверяем, что пользователь является создателем события
    if (event.creatorId !== user.id) {
      throw new ForbiddenException('Недостаточно прав для обновления этого события');
    }

    return this.eventService.update(id, eventData);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить событие' })
  @ApiResponse({ status: 204, description: 'Событие удалено успешно' })
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string, @Request() req: any): Promise<void> {
    const user = req.user;
    if (!user) {
      throw new ForbiddenException('Пользователь не авторизован');
    }

    const event = await this.eventService.findById(id);
    if (!event) {
      throw new ForbiddenException('Событие не найдено');
    }

    // Проверяем, что пользователь является создателем события
    if (event.creatorId !== user.id) {
      throw new ForbiddenException('Недостаточно прав для удаления этого события');
    }

    return this.eventService.delete(id);
  }

  @Post(':id/participants')
  @ApiOperation({ summary: 'Подать заявку на участие в событии (устаревший метод, используйте event-participation-requests)' })
  @ApiResponse({ status: 200, description: 'Заявка создана успешно' })
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  async addParticipant(@Param('id') _eventId: string, @Request() req: any): Promise<Event | null> {
    const user = req.user;
    if (!user) {
      throw new ForbiddenException('Пользователь не авторизован');
    }
    // Теперь этот метод создает заявку, а не сразу добавляет участника
    // Для обратной совместимости оставляем, но логика изменена
    // Вместо прямого добавления нужно использовать систему заявок
    // Этот endpoint больше не должен использоваться напрямую
    throw new BadRequestException('Используйте систему заявок для присоединения к событию');
  }

  @Delete(':id/participants/:userId')
  @ApiOperation({ summary: 'Удалить участника из события (только для создателя)' })
  @ApiResponse({ status: 200, description: 'Участник удален успешно' })
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  async removeParticipantByCreator(
    @Param('id') eventId: string,
    @Param('userId') userId: string,
    @Request() req: any
  ): Promise<Event | null> {
    const user = req.user;
    if (!user) {
      throw new ForbiddenException('Пользователь не авторизован');
    }

    const event = await this.eventService.findById(eventId);
    if (!event) {
      throw new ForbiddenException('Событие не найдено');
    }

    // Проверяем, что пользователь является создателем события
    if (event.creatorId !== user.id) {
      throw new ForbiddenException('Только создатель события может удалять участников');
    }

    // Нельзя удалить создателя
    if (userId === event.creatorId) {
      throw new ForbiddenException('Нельзя удалить создателя события');
    }

    return this.eventService.removeParticipant(eventId, userId);
  }

  @Delete(':id/participants')
  @ApiOperation({ summary: 'Удалить участника из события (текущий пользователь)' })
  @ApiResponse({ status: 200, description: 'Участник удален успешно' })
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  async removeParticipant(@Param('id') eventId: string, @Request() req: any): Promise<Event | null> {
    const user = req.user;
    if (!user) {
      throw new ForbiddenException('Пользователь не авторизован');
    }
    return this.eventService.removeParticipant(eventId, user.id);
  }

  @Get(':id/participants')
  @ApiOperation({ summary: 'Получить список участников события' })
  @ApiResponse({ status: 200, description: 'Список участников получен успешно' })
  async getParticipants(@Param('id') eventId: string): Promise<any[]> {
    return this.eventService.getParticipants(eventId);
  }
}

