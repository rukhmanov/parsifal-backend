import { Injectable } from '@nestjs/common';
import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { FilterRequestDto, FilterResponseDto, SortDirection } from '../dto/filter.dto';

export interface FilterField {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  searchable?: boolean;
  sortable?: boolean;
  isStatusFilter?: boolean;
}

@Injectable()
export class FilterService {
  /**
   * Применяет фильтрацию к TypeORM QueryBuilder
   */
  applyFilters<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    request: FilterRequestDto,
    entityFields: FilterField[],
    entityAlias: string = 'entity'
  ): SelectQueryBuilder<T> {
    // Глобальный поиск
    if (request.search) {
      this.applyGlobalSearch(queryBuilder, request.search, entityFields, entityAlias);
    }

    // Фильтрация по полям
    if (request.filters) {
      this.applyFieldFilters(queryBuilder, request.filters, entityFields, entityAlias);
    }

    // Сортировка
    if (request.sort) {
      this.applySorting(queryBuilder, request.sort, entityFields, entityAlias);
    }

    // Пагинация
    if (request.pagination) {
      this.applyPagination(queryBuilder, request.pagination);
    }

    return queryBuilder;
  }

  /**
   * Применяет глобальный поиск по всем поисковым полям
   */
  private applyGlobalSearch<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    searchTerm: string,
    entityFields: FilterField[],
    entityAlias: string
  ): void {
    const searchableFields = entityFields.filter(field => field.searchable !== false);
    
    if (searchableFields.length === 0) return;

    const searchConditions = searchableFields.map(field => {
      const fieldPath = `${entityAlias}.${field.key}`;
      
      switch (field.type) {
        case 'string':
          return `LOWER(${fieldPath}) LIKE LOWER(:searchTerm)`;
        case 'number':
          return `CAST(${fieldPath} AS TEXT) LIKE :searchTerm`;
        case 'boolean':
          return `CAST(${fieldPath} AS TEXT) LIKE :searchTerm`;
        case 'date':
          return `TO_CHAR(${fieldPath}, 'YYYY-MM-DD') LIKE :searchTerm`;
        default:
          return `LOWER(${fieldPath}) LIKE LOWER(:searchTerm)`;
      }
    });

    queryBuilder.andWhere(`(${searchConditions.join(' OR ')})`, {
      searchTerm: `%${searchTerm}%`
    });
  }

  /**
   * Применяет фильтрацию по конкретным полям
   */
  private applyFieldFilters<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    filters: Record<string, any>,
    entityFields: FilterField[],
    entityAlias: string
  ): void {
    Object.entries(filters).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') return;

      const field = entityFields.find(f => f.key === key);
      if (!field) return;

      const fieldPath = `${entityAlias}.${field.key}`;

      switch (field.type) {
        case 'string':
          queryBuilder.andWhere(`LOWER(${fieldPath}) LIKE LOWER(:${key})`, {
            [key]: `%${value}%`
          });
          break;
        case 'number':
          if (typeof value === 'number') {
            queryBuilder.andWhere(`${fieldPath} = :${key}`, { [key]: value });
          } else if (typeof value === 'string' && !isNaN(Number(value))) {
            queryBuilder.andWhere(`${fieldPath} = :${key}`, { [key]: Number(value) });
          }
          break;
        case 'boolean':
          const boolValue = value === 'true' || value === true;
          queryBuilder.andWhere(`${fieldPath} = :${key}`, { [key]: boolValue });
          break;
        case 'date':
          if (value instanceof Date) {
            queryBuilder.andWhere(`DATE(${fieldPath}) = DATE(:${key})`, { [key]: value });
          } else if (typeof value === 'string') {
            queryBuilder.andWhere(`DATE(${fieldPath}) = DATE(:${key})`, { [key]: value });
          }
          break;
      }
    });
  }

  /**
   * Применяет сортировку
   */
  private applySorting<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    sort: { field: string; direction: SortDirection },
    entityFields: FilterField[],
    entityAlias: string
  ): void {
    const field = entityFields.find(f => f.key === sort.field);
    if (!field || field.sortable === false) return;

    const fieldPath = `${entityAlias}.${field.key}`;
    const direction = sort.direction.toUpperCase() as 'ASC' | 'DESC';
    
    queryBuilder.orderBy(fieldPath, direction);
  }

  /**
   * Применяет пагинацию
   */
  private applyPagination<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    pagination: { page: number; pageSize: number }
  ): void {
    const offset = (pagination.page - 1) * pagination.pageSize;
    queryBuilder.skip(offset).take(pagination.pageSize);
  }

  /**
   * Создает ответ с пагинацией
   */
  async createPaginatedResponse<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    request: FilterRequestDto
  ): Promise<FilterResponseDto<T>> {
    // Получаем общее количество записей
    const total = await queryBuilder.getCount();

    // Применяем пагинацию и получаем данные
    const data = await queryBuilder.getMany();

    const page = request.pagination?.page || 1;
    const pageSize = request.pagination?.pageSize || 20;

    return new FilterResponseDto(data, total, page, pageSize);
  }

  /**
   * Создает фильтр для простых запросов без QueryBuilder
   */
  createSimpleFilter(request: FilterRequestDto): any {
    const where: any = {};

    // Простая фильтрация по полям (без глобального поиска)
    if (request.filters) {
      Object.entries(request.filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          where[key] = value;
        }
      });
    }

    return {
      where,
      order: request.sort ? {
        [request.sort.field]: request.sort.direction.toUpperCase()
      } : undefined,
      skip: request.pagination ? (request.pagination.page - 1) * request.pagination.pageSize : undefined,
      take: request.pagination?.pageSize || undefined
    };
  }
}
