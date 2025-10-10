import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { FilterService } from '../../common/services/filter.service';
import { FilterRequestDto, FilterResponseDto } from '../../common/dto/filter.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly filterService: FilterService,
  ) {}

  // Конфигурация полей для фильтрации пользователей
  private readonly userFilterFields = [
    { key: 'email', type: 'string' as const, searchable: true, sortable: true },
    { key: 'firstName', type: 'string' as const, searchable: true, sortable: true },
    { key: 'lastName', type: 'string' as const, searchable: true, sortable: true },
    { key: 'displayName', type: 'string' as const, searchable: true, sortable: true },
    { key: 'isActive', type: 'boolean' as const, searchable: false, sortable: true, isStatusFilter: true },
    { key: 'authProvider', type: 'string' as const, searchable: false, sortable: true, isStatusFilter: true },
    { key: 'createdAt', type: 'date' as const, searchable: false, sortable: true, isRangeFilter: true },
    { key: 'updatedAt', type: 'date' as const, searchable: false, sortable: true, isRangeFilter: true },
  ];

  async findByEmailAndProvider(email: string, providerId: string, authProvider: 'google' | 'yandex'): Promise<User | null> {
    return await this.userRepository.findOne({
      where: {
        email,
        providerId,
        authProvider,
      },
    });
  }

  async create(userData: Partial<User>): Promise<User> {
    const user = this.userRepository.create(userData);
    return await this.userRepository.save(user);
  }

  async update(id: string, userData: Partial<User>): Promise<User | null> {
    await this.userRepository.update(id, userData);
    return await this.userRepository.findOne({ where: { id } });
  }

  async findById(id: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { email } });
  }

  async findByEmailAndAuthProvider(email: string, authProvider: 'google' | 'yandex' | 'local'): Promise<User | null> {
    return await this.userRepository.findOne({ 
      where: { 
        email,
        authProvider 
      } 
    });
  }

  async updateResetToken(id: string, resetToken: string, resetTokenExpiry: Date): Promise<void> {
    await this.userRepository.update(id, {
      resetToken,
      resetTokenExpiry,
    });
  }

  async findByResetToken(token: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { resetToken: token },
      relations: [],
    });
  }

  async updatePassword(id: string, hashedPassword: string): Promise<void> {
    await this.userRepository.update(id, {
      password: hashedPassword,
    });
  }

  async clearResetToken(id: string): Promise<void> {
    await this.userRepository.update(id, {
      resetToken: undefined,
      resetTokenExpiry: undefined,
    });
  }

  // Получение всех пользователей (для админ панели)
  async findAll(): Promise<User[]> {
    return await this.userRepository.find({
      select: ['id', 'email', 'firstName', 'lastName', 'displayName', 'avatar', 'authProvider', 'isActive', 'createdAt', 'updatedAt'],
      order: { createdAt: 'DESC' }
    });
  }

  // Получение пользователей с фильтрацией
  async findAllWithFilters(request: FilterRequestDto): Promise<FilterResponseDto<User>> {
    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.email',
        'user.firstName',
        'user.lastName',
        'user.displayName',
        'user.avatar',
        'user.authProvider',
        'user.isActive',
        'user.createdAt',
        'user.updatedAt'
      ]);

    // Применяем фильтрацию
    this.filterService.applyFilters(queryBuilder, request, this.userFilterFields, 'user');

    // Создаем ответ с пагинацией
    return await this.filterService.createPaginatedResponse(queryBuilder, request);
  }

  // Получение пользователей с фильтрацией (простой метод без QueryBuilder)
  async findAllWithSimpleFilters(request: FilterRequestDto): Promise<FilterResponseDto<User>> {
    const filterOptions = this.filterService.createSimpleFilter(request);
    
    // Получаем общее количество
    const total = await this.userRepository.count(filterOptions.where || {});
    
    // Получаем данные
    const data = await this.userRepository.find({
      select: ['id', 'email', 'firstName', 'lastName', 'displayName', 'avatar', 'authProvider', 'isActive', 'createdAt', 'updatedAt'],
      ...filterOptions
    });

    const page = request.pagination?.page || 1;
    const pageSize = request.pagination?.pageSize || 20;

    return new FilterResponseDto(data, total, page, pageSize);
  }

  // Получение конфигурации полей для фильтрации
  getFilterFields() {
    return this.userFilterFields;
  }
}
