import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Chat } from './chat.entity';
import { User } from '../user/user.entity';

@Entity('messages')
@Index(['chatId', 'createdAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  chatId!: string;

  @ManyToOne(() => Chat, chat => chat.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chatId' })
  chat!: Chat;

  @Column()
  senderId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'senderId' })
  sender!: User;

  @Column({ type: 'text' })
  content!: string;

  @Column({ nullable: true })
  replyToMessageId?: string;

  @ManyToOne(() => Message, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'replyToMessageId' })
  replyToMessage?: Message;

  @Column({ type: 'boolean', default: false })
  isEdited!: boolean;

  @Column({ type: 'boolean', default: false })
  isDeleted!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

