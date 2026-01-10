import { IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FindReportsDto {
  @ApiPropertyOptional({ description: 'Статус жалобы' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Email пользователя, на которого пожаловались' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Номер страницы', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Размер страницы', default: 15 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  pageSize?: number;
}

