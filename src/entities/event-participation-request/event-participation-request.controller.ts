import { Controller, Post, Delete, Get, Param, Body, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { EventParticipationRequestService } from './event-participation-request.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('event-participation-requests')
@Controller('event-participation-requests')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class EventParticipationRequestController {
  constructor(
    private readonly requestService: EventParticipationRequestService
  ) {}

  @Post('invite/:eventId/:userId')
  @ApiOperation({ summary: 'Отправить приглашение на участие в событии' })
  @ApiResponse({ status: 201, description: 'Приглашение успешно отправлено' })
  @HttpCode(HttpStatus.CREATED)
  async sendInvitation(
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
    @Body() body: { comment?: string },
    @Request() req: any
  ) {
    const creatorId = req.user.id;
    return await this.requestService.sendInvitation(eventId, userId, creatorId, body.comment);
  }

  @Post('apply/:eventId')
  @ApiOperation({ summary: 'Подать заявку на участие в событии' })
  @ApiResponse({ status: 201, description: 'Заявка успешно отправлена' })
  @HttpCode(HttpStatus.CREATED)
  async sendApplication(
    @Param('eventId') eventId: string,
    @Body() body: {
      ageMatches?: boolean;
      genderMatches?: boolean;
      itemsCanBring?: string[];
      canBringMoney?: boolean;
      meetsRequirements?: boolean;
      comment?: string;
    },
    @Request() req: any
  ) {
    const userId = req.user.id;
    return await this.requestService.sendApplication(eventId, userId, body);
  }

  @Post('accept/:requestId')
  @ApiOperation({ summary: 'Принять заявку/приглашение' })
  @ApiResponse({ status: 200, description: 'Заявка принята' })
  @HttpCode(HttpStatus.OK)
  async acceptRequest(
    @Param('requestId') requestId: string,
    @Request() req: any
  ) {
    const userId = req.user.id;
    await this.requestService.acceptRequest(requestId, userId);
    return { message: 'Заявка принята' };
  }

  @Post('reject/:requestId')
  @ApiOperation({ summary: 'Отклонить заявку/приглашение' })
  @ApiResponse({ status: 200, description: 'Заявка отклонена' })
  @HttpCode(HttpStatus.OK)
  async rejectRequest(
    @Param('requestId') requestId: string,
    @Request() req: any
  ) {
    const userId = req.user.id;
    await this.requestService.rejectRequest(requestId, userId);
    return { message: 'Заявка отклонена' };
  }

  @Delete('request/:requestId')
  @ApiOperation({ summary: 'Отменить заявку/приглашение по ID заявки' })
  @ApiResponse({ status: 200, description: 'Заявка отменена' })
  @HttpCode(HttpStatus.OK)
  async cancelRequestById(
    @Param('requestId') requestId: string,
    @Request() req: any
  ) {
    const currentUserId = req.user.id;
    await this.requestService.cancelRequestById(requestId, currentUserId);
    return { message: 'Заявка отменена' };
  }

  @Delete(':eventId/:userId')
  @ApiOperation({ summary: 'Отменить заявку/приглашение' })
  @ApiResponse({ status: 200, description: 'Заявка отменена' })
  @HttpCode(HttpStatus.OK)
  async cancelRequest(
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
    @Request() req: any
  ) {
    const currentUserId = req.user.id;
    // userId - это ID пользователя, для которого отменяется заявка
    // Для приглашений это ID приглашенного пользователя
    // Для заявок это ID пользователя, который подал заявку (должен совпадать с currentUserId)
    await this.requestService.cancelRequest(eventId, userId, currentUserId);
    return { message: 'Заявка отменена' };
  }

  @Get('event/:eventId/received')
  @ApiOperation({ summary: 'Получить входящие заявки на участие в событии' })
  @ApiResponse({ status: 200, description: 'Список входящих заявок получен успешно' })
  async getReceivedRequests(
    @Param('eventId') eventId: string,
    @Request() req: any
  ) {
    const userId = req.user.id;
    return await this.requestService.getReceivedRequests(eventId, userId);
  }

  @Get('event/:eventId/sent')
  @ApiOperation({ summary: 'Получить исходящие приглашения на участие в событии' })
  @ApiResponse({ status: 200, description: 'Список исходящих приглашений получен успешно' })
  async getSentInvitations(
    @Param('eventId') eventId: string,
    @Request() req: any
  ) {
    const userId = req.user.id;
    return await this.requestService.getSentInvitations(eventId, userId);
  }

  @Get('user/received-invitations')
  @ApiOperation({ summary: 'Получить входящие приглашения пользователя' })
  @ApiResponse({ status: 200, description: 'Список входящих приглашений получен успешно' })
  async getReceivedInvitations(@Request() req: any) {
    const userId = req.user.id;
    return await this.requestService.getReceivedInvitations(userId);
  }

  @Get('user/sent-applications')
  @ApiOperation({ summary: 'Получить исходящие заявки пользователя' })
  @ApiResponse({ status: 200, description: 'Список исходящих заявок получен успешно' })
  async getSentApplications(@Request() req: any) {
    const userId = req.user.id;
    return await this.requestService.getSentApplications(userId);
  }

  @Get('friends-for-invitation')
  @ApiOperation({ summary: 'Получить список друзей для отправки приглашений' })
  @ApiResponse({ status: 200, description: 'Список друзей получен успешно' })
  async getFriendsForInvitation(@Request() req: any) {
    const userId = req.user.id;
    return await this.requestService.getFriendsForInvitation(userId);
  }
}

