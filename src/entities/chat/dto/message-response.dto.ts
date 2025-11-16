import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../user/user.entity';

export class MessageResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  chatId!: string;

  @ApiProperty({ type: () => User })
  sender!: User;

  @ApiProperty()
  content!: string;

  @ApiProperty()
  isEdited!: boolean;

  @ApiProperty()
  isDeleted!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

