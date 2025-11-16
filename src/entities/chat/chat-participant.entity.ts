import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Chat } from './chat.entity';
import { User } from '../user/user.entity';

@Entity('chat_participants')
@Index(['chatId', 'userId'], { unique: true })
export class ChatParticipant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  chatId!: string;

  @ManyToOne(() => Chat, chat => chat.participants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chatId' })
  chat!: Chat;

  @Column()
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'timestamptz', nullable: true })
  lastReadAt?: Date; // Время последнего прочтения сообщений

  @CreateDateColumn()
  createdAt!: Date;
}

