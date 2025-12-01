import { IsString, IsNotEmpty, MinLength, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMessageDto {
  @ApiProperty({ description: 'Содержимое сообщения' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  content!: string;

  @ApiPropertyOptional({ description: 'ID сообщения, на которое отвечаем' })
  @IsOptional()
  @IsUUID()
  replyToMessageId?: string;
}

