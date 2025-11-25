import { Controller, Post, Delete, Get, Param, Body, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FriendRequestService } from './friend-request.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('friend-requests')
@Controller('friend-requests')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class FriendRequestController {
  constructor(
    private readonly friendRequestService: FriendRequestService
  ) {}

  @Post(':receiverId')
  @ApiOperation({ summary: 'Отправить заявку в друзья' })
  @ApiResponse({ status: 201, description: 'Заявка успешно отправлена' })
  @ApiResponse({ status: 400, description: 'Некорректный запрос' })
  @ApiResponse({ status: 404, description: 'Пользователь не найден' })
  @HttpCode(HttpStatus.CREATED)
  async sendFriendRequest(
    @Param('receiverId') receiverId: string,
    @Body() body: { comment?: string },
    @Request() req: any
  ) {
    const senderId = req.user.id;
    return await this.friendRequestService.createFriendRequest(senderId, receiverId, body.comment);
  }

  @Delete(':receiverId')
  @ApiOperation({ summary: 'Отменить заявку в друзья' })
  @ApiResponse({ status: 200, description: 'Заявка успешно отменена' })
  @ApiResponse({ status: 404, description: 'Заявка не найдена' })
  @HttpCode(HttpStatus.OK)
  async cancelFriendRequest(
    @Param('receiverId') receiverId: string,
    @Request() req: any
  ) {
    const senderId = req.user.id;
    await this.friendRequestService.cancelFriendRequest(senderId, receiverId);
    return { message: 'Заявка отменена' };
  }

  @Get('friends')
  @ApiOperation({ summary: 'Получить список друзей' })
  @ApiResponse({ status: 200, description: 'Список друзей получен успешно' })
  async getFriends(@Request() req: any) {
    const userId = req.user.id;
    return await this.friendRequestService.getFriends(userId);
  }

  @Get('sent')
  @ApiOperation({ summary: 'Получить список исходящих заявок' })
  @ApiResponse({ status: 200, description: 'Список исходящих заявок получен успешно' })
  async getSentFriendRequests(@Request() req: any) {
    const userId = req.user.id;
    return await this.friendRequestService.getSentFriendRequestsWithUsers(userId);
  }

  @Get('received')
  @ApiOperation({ summary: 'Получить список входящих заявок' })
  @ApiResponse({ status: 200, description: 'Список входящих заявок получен успешно' })
  async getReceivedFriendRequests(@Request() req: any) {
    const userId = req.user.id;
    return await this.friendRequestService.getReceivedFriendRequestsWithUsers(userId);
  }

  @Post('accept/:senderId')
  @ApiOperation({ summary: 'Принять заявку в друзья' })
  @ApiResponse({ status: 200, description: 'Заявка успешно принята' })
  @ApiResponse({ status: 404, description: 'Заявка не найдена' })
  @HttpCode(HttpStatus.OK)
  async acceptFriendRequest(
    @Param('senderId') senderId: string,
    @Request() req: any
  ) {
    const receiverId = req.user.id;
    await this.friendRequestService.acceptFriendRequest(receiverId, senderId);
    return { message: 'Заявка принята' };
  }

  @Post('reject/:senderId')
  @ApiOperation({ summary: 'Отклонить заявку в друзья' })
  @ApiResponse({ status: 200, description: 'Заявка успешно отклонена' })
  @ApiResponse({ status: 404, description: 'Заявка не найдена' })
  @HttpCode(HttpStatus.OK)
  async rejectFriendRequest(
    @Param('senderId') senderId: string,
    @Request() req: any
  ) {
    const receiverId = req.user.id;
    await this.friendRequestService.rejectFriendRequest(receiverId, senderId);
    return { message: 'Заявка отклонена' };
  }

  @Delete('friend/:friendId')
  @ApiOperation({ summary: 'Удалить друга' })
  @ApiResponse({ status: 200, description: 'Друг успешно удален' })
  @HttpCode(HttpStatus.OK)
  async removeFriend(
    @Param('friendId') friendId: string,
    @Request() req: any
  ) {
    const userId = req.user.id;
    await this.friendRequestService.removeFriend(userId, friendId);
    return { message: 'Друг удален' };
  }
}

