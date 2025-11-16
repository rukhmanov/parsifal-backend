import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { Event } from '../event/event.entity';
import { Message } from './message.entity';
import { ChatParticipant } from './chat-participant.entity';

export enum ChatType {
  USER = 'user', // Личный чат между пользователями
  EVENT = 'event', // Чат события
}

@Entity('chats')
@Index(['type', 'eventId'], { unique: true, where: '"eventId" IS NOT NULL' })
export class Chat {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: ChatType, default: ChatType.USER })
  type!: ChatType;

  @Column({ nullable: true })
  eventId?: string; // ID события, если это чат события

  @ManyToOne(() => Event, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event?: Event;

  @OneToMany(() => Message, message => message.chat, { cascade: true })
  messages!: Message[];

  @OneToMany(() => ChatParticipant, participant => participant.chat, { cascade: true })
  participants!: ChatParticipant[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

