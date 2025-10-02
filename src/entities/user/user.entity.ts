import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

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

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
