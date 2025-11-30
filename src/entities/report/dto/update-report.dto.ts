import { IsOptional, IsString, IsIn, IsUUID } from 'class-validator';

export class UpdateReportDto {
  @IsOptional()
  @IsString({ message: 'Статус должен быть строкой' })
  @IsIn(['pending', 'reviewed', 'resolved', 'rejected'], {
    message: 'Некорректный статус'
  })
  status?: 'pending' | 'reviewed' | 'resolved' | 'rejected';

  @IsOptional()
  @IsString({ message: 'Заметки должны быть строкой' })
  adminNotes?: string;
}

