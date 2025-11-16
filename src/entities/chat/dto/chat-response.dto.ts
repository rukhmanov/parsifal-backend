import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChatType } from '../chat.entity';
import { User } from '../../user/user.entity';
import { Event } from '../../event/event.entity';
import { Message } from '../message.entity';

export class ChatResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ChatType })
  type!: ChatType;

  @ApiPropertyOptional()
  eventId?: string;

  @ApiPropertyOptional({ type: () => Event })
  event?: Event;

  @ApiProperty({ type: [User] })
  participants!: User[];

  @ApiPropertyOptional({ type: () => Message })
  lastMessage?: Message;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

