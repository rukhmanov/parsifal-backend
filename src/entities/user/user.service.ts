import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { Event } from '../event/event.entity';
import { FilterService } from '../../common/services/filter.service';
import { FilterRequestDto, FilterResponseDto } from '../../common/dto/filter.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    private readonly filterService: FilterService,
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
      relations: ['role', 'role.permissions']
    });
  }

  async create(userData: Partial<User>): Promise<User> {
    // Принудительно устанавливаем roleId в undefined при создании пользователя
    userData.roleId = undefined;
    
    const user = this.userRepository.create(userData);
    return await this.userRepository.save(user);
  }

  async update(id: string, userData: Partial<User>): Promise<User | null> {
    await this.userRepository.update(id, userData);
    
    // Принудительно перезагружаем пользователя с обновленными связями
    // Используем cache: false чтобы избежать проблем с кэшированием
    return await this.userRepository.findOne({ 
      where: { id },
      relations: ['role', 'role.permissions'],
      cache: false
    });
  }

  async delete(id: string): Promise<void> {
    // Удаляем все события пользователя перед удалением пользователя
    await this.eventRepository.delete({ creatorId: id });
    // Теперь можно безопасно удалить пользователя
    await this.userRepository.delete(id);
  }

  async findById(id: string): Promise<User | null> {
    return await this.userRepository.findOne({ 
      where: { id },
      relations: ['role', 'role.permissions']
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
      relations: ['role', 'role.permissions'],
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

  async blockUser(userId: string, reason: string, blockedUntil?: Date): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new Error('Пользователь не найден');
    }

    user.isBlocked = true;
    user.blockReason = reason;
    user.blockedUntil = blockedUntil || null; // null = permanent block

    return this.userRepository.save(user);
  }

  async unblockUser(userId: string): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new Error('Пользователь не найден');
    }

    user.isBlocked = false;
    user.blockReason = null;
    user.blockedUntil = null;

    return this.userRepository.save(user);
  }

  async checkIfBlocked(userId: string): Promise<boolean> {
    const user = await this.findById(userId);
    if (!user) {
      return false;
    }

    // Если пользователь заблокирован
    if (user.isBlocked) {
      // Если есть временная блокировка, проверяем срок
      if (user.blockedUntil) {
        // Если срок блокировки истек, разблокируем
        if (new Date() > user.blockedUntil) {
          await this.unblockUser(userId);
          return false;
        }
        return true;
      }
      // Постоянная блокировка
      return true;
    }

    return false;
  }
}
