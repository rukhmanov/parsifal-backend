import { Controller, Post, Delete, Get, Param, Body, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FriendRequestService } from './friend-request.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FilterRequestDto } from '../../common/dto/filter.dto';
import { FilterBody } from '../../common/decorators/filter.decorator';

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
    const skip = parseInt(req.query.skip) || 0;
    const take = parseInt(req.query.take) || 20;
    
    // Если указаны параметры пагинации, используем метод с пагинацией
    if (req.query.skip !== undefined || req.query.take !== undefined) {
      return await this.friendRequestService.getFriendsPaginated(userId, skip, take);
    }
    
    // Иначе возвращаем все данные (для обратной совместимости)
    const friends = await this.friendRequestService.getFriends(userId);
    return { data: friends, total: friends.length };
  }

  @Get('sent')
  @ApiOperation({ summary: 'Получить список исходящих заявок' })
  @ApiResponse({ status: 200, description: 'Список исходящих заявок получен успешно' })
  async getSentFriendRequests(@Request() req: any) {
    const userId = req.user.id;
    const skip = parseInt(req.query.skip) || 0;
    const take = parseInt(req.query.take) || 20;
    
    // Если указаны параметры пагинации, используем метод с пагинацией
    if (req.query.skip !== undefined || req.query.take !== undefined) {
      return await this.friendRequestService.getSentFriendRequestsPaginated(userId, skip, take);
    }
    
    // Иначе возвращаем все данные (для обратной совместимости)
    const requests = await this.friendRequestService.getSentFriendRequestsWithUsers(userId);
    return { data: requests, total: requests.length };
  }

  @Get('received')
  @ApiOperation({ summary: 'Получить список входящих заявок' })
  @ApiResponse({ status: 200, description: 'Список входящих заявок получен успешно' })
  async getReceivedFriendRequests(@Request() req: any) {
    const userId = req.user.id;
    const skip = parseInt(req.query.skip) || 0;
    const take = parseInt(req.query.take) || 20;
    
    // Если указаны параметры пагинации, используем метод с пагинацией
    if (req.query.skip !== undefined || req.query.take !== undefined) {
      return await this.friendRequestService.getReceivedFriendRequestsPaginated(userId, skip, take);
    }
    
    // Иначе возвращаем все данные (для обратной совместимости)
    const requests = await this.friendRequestService.getReceivedFriendRequestsWithUsers(userId);
    return { data: requests, total: requests.length };
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

  @Post('friends/search')
  @ApiOperation({ summary: 'Получить список друзей с фильтрацией' })
  @ApiResponse({ status: 200, description: 'Список друзей получен успешно' })
  async searchFriends(
    @Request() req: any,
    @FilterBody() filterRequest: FilterRequestDto
  ) {
    const userId = req.user.id;
    return await this.friendRequestService.getFriendsWithFilters(userId, filterRequest);
  }

  @Post('sent/search')
  @ApiOperation({ summary: 'Получить список исходящих заявок с фильтрацией' })
  @ApiResponse({ status: 200, description: 'Список исходящих заявок получен успешно' })
  async searchSentFriendRequests(
    @Request() req: any,
    @FilterBody() filterRequest: FilterRequestDto
  ) {
    const userId = req.user.id;
    return await this.friendRequestService.getSentFriendRequestsWithFilters(userId, filterRequest);
  }

  @Post('received/search')
  @ApiOperation({ summary: 'Получить список входящих заявок с фильтрацией' })
  @ApiResponse({ status: 200, description: 'Список входящих заявок получен успешно' })
  async searchReceivedFriendRequests(
    @Request() req: any,
    @FilterBody() filterRequest: FilterRequestDto
  ) {
    const userId = req.user.id;
    return await this.friendRequestService.getReceivedFriendRequestsWithFilters(userId, filterRequest);
  }
}

