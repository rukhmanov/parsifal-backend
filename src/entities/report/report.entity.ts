import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../user/user.entity';

export type ReportType = 
  | 'spam' 
  | 'harassment' 
  | 'inappropriate_content' 
  | 'fake_profile' 
  | 'scam' 
  | 'violence' 
  | 'other';

export type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'rejected';

@Entity('reports')
@Index(['reportedUserId', 'reporterId']) // Индекс для быстрого поиска
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  reporterId!: string; // ID пользователя, который подал жалобу

  @Column()
  reportedUserId!: string; // ID пользователя, на которого пожаловались

  @Column({ type: 'varchar', length: 50 })
  type!: ReportType; // Тип жалобы

  @Column({ type: 'text', nullable: true })
  description?: string; // Описание проблемы

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: ReportStatus; // Статус обработки жалобы

  @Column({ type: 'text', nullable: true })
  adminNotes?: string; // Заметки администратора

  @Column({ nullable: true })
  reviewedBy?: string; // ID администратора, который обработал жалобу

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt?: Date; // Дата обработки

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporterId' })
  reporter!: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reportedUserId' })
  reportedUser!: User;

  @CreateDateColumn()
  createdAt!: Date;
}


