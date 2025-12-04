import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../user/user.entity';
import { Event } from '../event/event.entity';

export enum NotificationType {
  FRIEND_REQUEST_RECEIVED = 'friend_request_received', // Кто-то отправил заявку в друзья
  FRIEND_REQUEST_ACCEPTED = 'friend_request_accepted', // Кто-то принял вашу заявку в друзья
  FRIEND_REQUEST_REJECTED = 'friend_request_rejected', // Кто-то отклонил вашу заявку в друзья
  FRIEND_REMOVED = 'friend_removed', // Кто-то удалил вас из друзей
  MESSAGE_RECEIVED = 'message_received', // Кто-то написал вам сообщение
  EVENT_REQUEST_RECEIVED = 'event_request_received', // Кто-то отправил заявку на участие в событие
  EVENT_REQUEST_ACCEPTED = 'event_request_accepted', // Кто-то принял вашу заявку на участие в событие
  EVENT_REQUEST_REJECTED = 'event_request_rejected', // Кто-то отклонил вашу заявку на участие в событие
  EVENT_PARTICIPANT_REMOVED = 'event_participant_removed', // Кто-то удалил вас из события
}

@Entity('notifications')
@Index(['userId', 'createdAt']) // Индекс для быстрого поиска по пользователю и дате
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string; // Пользователь, для которого уведомление

  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type!: NotificationType;

  @Column({ nullable: true })
  actorId?: string; // Пользователь, который выполнил действие (отправил заявку, принял и т.д.)

  @Column({ nullable: true })
  eventId?: string; // ID события, если уведомление связано с событием

  @Column({ nullable: true })
  chatId?: string; // ID чата, если уведомление связано с сообщением

  @Column({ type: 'text', nullable: true })
  message?: string; // Дополнительное сообщение

  @Column({ type: 'boolean', default: false })
  isRead!: boolean; // Прочитано ли уведомление

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'actorId' })
  actor?: User; // Пользователь, который выполнил действие

  @ManyToOne(() => Event, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'eventId' })
  event?: Event;

  @CreateDateColumn()
  createdAt!: Date;
}




