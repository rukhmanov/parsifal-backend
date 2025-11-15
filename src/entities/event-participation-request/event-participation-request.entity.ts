import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../user/user.entity';
import { Event } from '../event/event.entity';

@Entity('event_participation_requests')
@Index(['eventId', 'userId'], { unique: true }) // Уникальный индекс для предотвращения дубликатов
export class EventParticipationRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  eventId!: string;

  @Column()
  userId!: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: 'pending' | 'accepted' | 'rejected'; // Статус заявки

  @Column({ type: 'varchar', length: 20, default: 'invitation' })
  type!: 'invitation' | 'application'; // Тип заявки: приглашение (от создателя) или заявка (от пользователя)

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event!: Event;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @CreateDateColumn()
  createdAt!: Date;
}

