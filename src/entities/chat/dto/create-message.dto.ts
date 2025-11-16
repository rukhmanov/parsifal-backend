import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMessageDto {
  @ApiProperty({ description: 'Содержимое сообщения' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  content!: string;
}

