export interface PermissionDefinition {
  code: string;
  name: string;
  description: string;
  category: string;
}

export const PERMISSIONS: PermissionDefinition[] = [
  // Пермишены для пользователей
  {
    code: 'users.view',
    name: 'Просмотр пользователей',
    description: 'Возможность просматривать список пользователей',
    category: 'Пользователи'
  },
  {
    code: 'users.edit',
    name: 'Редактирование пользователей',
    description: 'Возможность редактировать данные пользователей',
    category: 'Пользователи'
  },
  {
    code: 'users.create',
    name: 'Создание пользователей',
    description: 'Возможность создавать новых пользователей',
    category: 'Пользователи'
  },
  {
    code: 'users.delete',
    name: 'Удаление пользователей',
    description: 'Возможность удалять пользователей',
    category: 'Пользователи'
  },
  {
    code: 'users.block',
    name: 'Блокировка пользователей',
    description: 'Возможность блокировать и разблокировать пользователей',
    category: 'Пользователи'
  },
  // Пермишены для ролей
  {
    code: 'roles.view',
    name: 'Просмотр ролей',
    description: 'Возможность просматривать список ролей',
    category: 'Роли'
  },
  {
    code: 'roles.edit',
    name: 'Редактирование ролей',
    description: 'Возможность редактировать данные ролей',
    category: 'Роли'
  },
  {
    code: 'roles.create',
    name: 'Создание ролей',
    description: 'Возможность создавать новые роли',
    category: 'Роли'
  },
  {
    code: 'roles.delete',
    name: 'Удаление ролей',
    description: 'Возможность удалять роли',
    category: 'Роли'
  },
  // Пермишены для статистики
  {
    code: 'statistics.view',
    name: 'Просмотр статистики',
    description: 'Возможность просматривать статистику системы',
    category: 'Статистика'
  },
  // Пермишены для файловой системы
  {
    code: 'filesystem.view',
    name: 'Просмотр файловой системы',
    description: 'Возможность просматривать файловую систему',
    category: 'Файлы'
  },
  // Пермишены для отчетов
  {
    code: 'reports.view',
    name: 'Просмотр отчетов',
    description: 'Возможность просматривать отчеты',
    category: 'Отчеты'
  },
  {
    code: 'reports.update',
    name: 'Обновление отчетов',
    description: 'Возможность обновлять статус отчетов',
    category: 'Отчеты'
  },
  {
    code: 'reports.delete',
    name: 'Удаление отчетов',
    description: 'Возможность удалять отчеты',
    category: 'Отчеты'
  }
];

// Хелперы для работы с пермишенами
export const getPermissionByCode = (code: string): PermissionDefinition | undefined => {
  return PERMISSIONS.find(p => p.code === code);
};

export const getAllPermissionCodes = (): string[] => {
  return PERMISSIONS.map(p => p.code);
};

export const getPermissionsByCategory = (): Record<string, PermissionDefinition[]> => {
  return PERMISSIONS.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {} as Record<string, PermissionDefinition[]>);
};

// Захардкоженная роль администратора (не хранится в БД)
export const ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000000';
export const ADMIN_ROLE_NAME = 'Администратор';
export const ADMIN_ROLE_DESCRIPTION = 'Полный доступ ко всем функциям системы';

export const getAdminRole = () => ({
  id: ADMIN_ROLE_ID,
  name: ADMIN_ROLE_NAME,
  description: ADMIN_ROLE_DESCRIPTION,
  permissionCodes: [] as string[], // Пустой массив - означает все права
  createdAt: new Date('2020-01-01T00:00:00.000Z'),
  updatedAt: new Date('2020-01-01T00:00:00.000Z'),
  users: [] // Пустой массив для соответствия типу Role
});

