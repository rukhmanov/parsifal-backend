import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../user/user.entity';

@Entity('friend_requests')
@Index(['senderId', 'receiverId'], { unique: true }) // Уникальный индекс для предотвращения дубликатов
export class FriendRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  senderId!: string;

  @Column()
  receiverId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'senderId' })
  sender!: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'receiverId' })
  receiver!: User;

  @Column({ type: 'text', nullable: true })
  comment?: string; // Комментарий к заявке

  @CreateDateColumn()
  createdAt!: Date;
}

