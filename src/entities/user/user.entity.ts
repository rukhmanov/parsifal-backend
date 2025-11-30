import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Role } from '../role/role.entity';

@Entity('users')
@Index(['email', 'authProvider'], { unique: true }) // Составной уникальный индекс
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  email!: string;

  @Column()
  firstName!: string;

  @Column()
  lastName!: string;

  @Column({ nullable: true })
  displayName?: string;

  @Column({ nullable: true })
  avatar?: string;

  @Column({ type: 'simple-array', nullable: true })
  photos?: string[]; // Фотографии пользователя (до 8)

  @Column({ type: 'date', nullable: true })
  birthDate?: Date; // Дата рождения

  @Column({ type: 'varchar', length: 20, nullable: true })
  gender?: 'male' | 'female'; // Пол пользователя

  @Column({ nullable: true })
  password?: string; // Только для локальных пользователей

  @Column({ nullable: true })
  resetToken?: string; // Токен для восстановления пароля

  @Column({ nullable: true })
  resetTokenExpiry?: Date; // Срок действия токена восстановления

  @Column({ type: 'varchar', length: 20 })
  authProvider!: 'google' | 'yandex' | 'local';

  @Column()
  providerId!: string;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ default: false })
  isBlocked!: boolean; // Заблокирован ли пользователь

  @Column({ type: 'text', nullable: true })
  blockReason?: string; // Причина блокировки

  @Column({ type: 'timestamp', nullable: true })
  blockedUntil?: Date; // Блокировка до определенной даты (null = permanent)

  @Column({ default: false })
  termsAccepted!: boolean; // Приняты ли условия использования

  @Column({ type: 'timestamp', nullable: true })
  termsAcceptedAt?: Date; // Дата принятия условий

  @Column({ default: false })
  privacyAccepted!: boolean; // Принята ли политика конфиденциальности

  @Column({ type: 'timestamp', nullable: true })
  privacyAcceptedAt?: Date; // Дата принятия политики

  @Column({ nullable: true })
  roleId?: string;

  @ManyToOne(() => Role, role => role.users, { nullable: true })
  @JoinColumn({ name: 'roleId' })
  role?: Role;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
