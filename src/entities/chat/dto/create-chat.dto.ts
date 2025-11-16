import { IsEnum, IsOptional, IsString, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChatType } from '../chat.entity';

export class CreateChatDto {
  @ApiProperty({ enum: ChatType, description: 'Тип чата' })
  @IsEnum(ChatType)
  type!: ChatType;

  @ApiPropertyOptional({ description: 'ID события (для чата события)' })
  @IsOptional()
  @IsString()
  eventId?: string;

  @ApiProperty({ description: 'ID участников чата', type: [String] })
  @IsArray()
  @IsString({ each: true })
  participantIds!: string[];
}

