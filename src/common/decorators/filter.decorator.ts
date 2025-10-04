import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { FilterRequestDto, SortDirection } from '../dto/filter.dto';

/**
 * Декоратор для извлечения параметров фильтрации из query параметров
 */
export const FilterQuery = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): FilterRequestDto => {
    const request = ctx.switchToHttp().getRequest();
    const query = request.query;

    const filterRequest: FilterRequestDto = {};

    // Глобальный поиск
    if (query.search) {
      filterRequest.search = query.search;
    }

    // Фильтры по полям
    const filters: Record<string, any> = {};
    Object.keys(query).forEach(key => {
      if (key.startsWith('filter[') && key.endsWith(']')) {
        const fieldName = key.slice(7, -1); // Убираем 'filter[' и ']'
        const value = query[key];
        
        if (value !== null && value !== undefined && value !== '') {
          // Пытаемся преобразовать в число, если это возможно
          if (!isNaN(Number(value))) {
            filters[fieldName] = Number(value);
          } else if (value === 'true' || value === 'false') {
            filters[fieldName] = value === 'true';
          } else {
            filters[fieldName] = value;
          }
        }
      }
    });

    if (Object.keys(filters).length > 0) {
      filterRequest.filters = filters;
    }

    // Сортировка
    if (query['sort[field]'] && query['sort[direction]']) {
      filterRequest.sort = {
        field: query['sort[field]'],
        direction: query['sort[direction]'] as SortDirection
      };
    }

    // Пагинация
    if (query.page || query.pageSize) {
      filterRequest.pagination = {
        page: query.page ? parseInt(query.page, 10) : 1,
        pageSize: query.pageSize ? parseInt(query.pageSize, 10) : 20
      };
    }

    return filterRequest;
  },
);

/**
 * Декоратор для извлечения параметров фильтрации из body запроса
 */
export const FilterBody = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): FilterRequestDto => {
    const request = ctx.switchToHttp().getRequest();
    return request.body as FilterRequestDto;
  },
);
