import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateMessageDto {
  @ApiProperty({ description: 'Новое содержимое сообщения' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  content!: string;
}

