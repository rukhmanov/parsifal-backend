import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
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
