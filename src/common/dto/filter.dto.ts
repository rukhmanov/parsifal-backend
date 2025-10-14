import { IsOptional, IsString, IsObject, IsNumber, IsEnum, Min, Max, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export class SortDto {
  @IsString()
  field!: string;

  @IsEnum(SortDirection)
  direction!: SortDirection;
}

export class PaginationDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  pageSize!: number;
}

export class FilterRequestDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsObject()
  filters?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  searchFields?: string[];

  @IsOptional()
  @Type(() => SortDto)
  sort?: SortDto;

  @IsOptional()
  @Type(() => PaginationDto)
  pagination?: PaginationDto;
}

export class FilterResponseDto<T> {
  data!: T[];
  total!: number;
  page!: number;
  pageSize!: number;
  totalPages!: number;

  constructor(data: T[], total: number, page: number, pageSize: number) {
    this.data = data;
    this.total = total;
    this.page = page;
    this.pageSize = pageSize;
    this.totalPages = Math.ceil(total / pageSize);
  }
}
