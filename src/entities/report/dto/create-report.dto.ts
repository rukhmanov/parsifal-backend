import { IsNotEmpty, IsString, IsIn, IsOptional, IsUUID } from 'class-validator';

export class CreateReportDto {
  @IsUUID('4', { message: 'Некорректный ID пользователя' })
  @IsNotEmpty({ message: 'ID пользователя обязателен' })
  reportedUserId!: string;

  @IsString({ message: 'Тип жалобы должен быть строкой' })
  @IsNotEmpty({ message: 'Тип жалобы обязателен' })
  @IsIn(['spam', 'harassment', 'inappropriate_content', 'fake_profile', 'scam', 'violence', 'other'], {
    message: 'Некорректный тип жалобы'
  })
  type!: 'spam' | 'harassment' | 'inappropriate_content' | 'fake_profile' | 'scam' | 'violence' | 'other';

  @IsOptional()
  @IsString({ message: 'Описание должно быть строкой' })
  description?: string;
}

