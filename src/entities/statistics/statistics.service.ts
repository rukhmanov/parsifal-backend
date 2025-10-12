import { Injectable } from '@nestjs/common';
import { UserService } from '../user/user.service';

@Injectable()
export class StatisticsService {
  constructor(private readonly userService: UserService) {}

  async getUserStatistics() {
    return this.userService.getUserStatistics();
  }
}
