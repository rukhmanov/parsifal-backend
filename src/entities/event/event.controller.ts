import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, ForbiddenException, HttpCode, HttpStatus } from '@nestjs/common';
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
  @ApiOperation({ summary: 'Получить список всех событий' })
  @ApiResponse({ status: 200, description: 'Список событий получен успешно' })
  async findAll(): Promise<Event[]> {
    return this.eventService.findAll();
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
  @ApiOperation({ summary: 'Добавить участника к событию' })
  @ApiResponse({ status: 200, description: 'Участник добавлен успешно' })
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  async addParticipant(@Param('id') eventId: string, @Request() req: any): Promise<Event | null> {
    const user = req.user;
    if (!user) {
      throw new ForbiddenException('Пользователь не авторизован');
    }
    return this.eventService.addParticipant(eventId, user.id);
  }

  @Delete(':id/participants')
  @ApiOperation({ summary: 'Удалить участника из события' })
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
}

