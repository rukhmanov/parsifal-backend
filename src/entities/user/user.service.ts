import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { FilterService } from '../../common/services/filter.service';
import { FilterRequestDto, FilterResponseDto } from '../../common/dto/filter.dto';
import { RoleService } from '../role/role.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly filterService: FilterService,
    private readonly roleService: RoleService,
  ) {}

  // Конфигурация полей для фильтрации пользователей
  private readonly userFilterFields = [
    { key: 'email', type: 'string' as const, searchable: true, sortable: true },
    { key: 'firstName', type: 'string' as const, searchable: true, sortable: true },
    { key: 'lastName', type: 'string' as const, searchable: true, sortable: true },
    { key: 'displayName', type: 'string' as const, searchable: true, sortable: true },
    { key: 'roleId', type: 'status-select' as const, searchable: false, sortable: true, isStatusFilter: true },
    { key: 'isActive', type: 'boolean' as const, searchable: false, sortable: true, isStatusFilter: true },
    { key: 'authProvider', type: 'status-select' as const, searchable: false, sortable: true, isStatusFilter: true },
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
      relations: ['role']
    });
  }

  async create(userData: Partial<User>): Promise<User> {
    // Если роль не указана, автоматически назначаем роль "Пользователь"
    if (!userData.roleId) {
      const defaultRole = await this.roleService.getDefaultUserRole();
      userData.roleId = defaultRole.id;
    }
    
    const user = this.userRepository.create(userData);
    return await this.userRepository.save(user);
  }

  async update(id: string, userData: Partial<User>): Promise<User | null> {
    await this.userRepository.update(id, userData);
    return await this.userRepository.findOne({ 
      where: { id },
      relations: ['role']
    });
  }

  async delete(id: string): Promise<void> {
    await this.userRepository.delete(id);
  }

  async findById(id: string): Promise<User | null> {
    return await this.userRepository.findOne({ 
      where: { id },
      relations: ['role']
    });
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
      select: ['id', 'email', 'firstName', 'lastName', 'displayName', 'avatar', 'authProvider', 'roleId', 'isActive', 'createdAt', 'updatedAt'],
      relations: ['role'],
      order: { createdAt: 'DESC' }
    });
  }

  // Получение пользователей с фильтрацией
  async findAllWithFilters(request: FilterRequestDto): Promise<FilterResponseDto<User>> {
    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .select([
        'user.id',
        'user.email',
        'user.firstName',
        'user.lastName',
        'user.displayName',
        'user.avatar',
        'user.authProvider',
        'user.roleId',
        'user.isActive',
        'user.createdAt',
        'user.updatedAt',
        'role.id',
        'role.name'
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

  // Обновление фото пользователя
  async updateUserPhoto(id: string, photoUrl: string): Promise<User | null> {
    await this.userRepository.update(id, { avatar: photoUrl });
    return await this.userRepository.findOne({ where: { id } });
  }

  // Получение статистики пользователей
  async getUserStatistics(): Promise<{
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    usersByProvider: { provider: string; count: number }[];
    usersByRole: { roleName: string; count: number }[];
  }> {
    const totalUsers = await this.userRepository.count();
    const activeUsers = await this.userRepository.count({ where: { isActive: true } });
    const inactiveUsers = totalUsers - activeUsers;

    // Статистика по провайдерам
    const usersByProvider = await this.userRepository
      .createQueryBuilder('user')
      .select('user.authProvider', 'provider')
      .addSelect('COUNT(*)', 'count')
      .groupBy('user.authProvider')
      .getRawMany();

    // Статистика по ролям
    const usersByRole = await this.userRepository
      .createQueryBuilder('user')
      .leftJoin('user.role', 'role')
      .select('COALESCE(role.name, \'Без роли\')', 'roleName')
      .addSelect('COUNT(*)', 'count')
      .groupBy('role.name')
      .getRawMany();

    return {
      totalUsers,
      activeUsers,
      inactiveUsers,
      usersByProvider: usersByProvider.map(item => ({
        provider: item.provider,
        count: parseInt(item.count)
      })),
      usersByRole: usersByRole.map(item => ({
        roleName: item.roleName,
        count: parseInt(item.count)
      }))
    };
  }
}
