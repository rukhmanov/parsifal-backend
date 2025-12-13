import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, ManyToMany, JoinColumn, JoinTable } from 'typeorm';
import { User } from '../user/user.entity';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  title!: string; // Название события (например, "Попить кофе", "Сходить в театр")

  @Column({ type: 'text', nullable: true })
  description?: string; // Описание события

  @Column({ type: 'timestamptz' })
  dateTime!: Date; // Время события

  @Column({ type: 'simple-array', nullable: true })
  itemsToBring?: string[]; // Вещи, которые нужно взять (массив строк)

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  moneyRequired?: number; // Деньги, которые необходимо взять

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude?: number; // Широта для геолокации

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude?: number; // Долгота для геолокации

  @Column({ type: 'text', nullable: true })
  address?: string; // Адрес события

  @Column({ type: 'text', nullable: true })
  addressComment?: string; // Комментарий к адресу

  @Column({ type: 'varchar', length: 255, nullable: true })
  region?: string; // Регион события

  @Column({ type: 'varchar', length: 10, nullable: true, name: 'regionCode' })
  regionCode?: string; // ISO код региона (например, RU-NIZ)

  @Column({ type: 'boolean', default: false })
  hideAddressForNonParticipants!: boolean; // Скрывать адрес для не участников

  @Column({ type: 'int', nullable: true })
  entrance?: number; // Подъезд

  @Column({ type: 'int', nullable: true })
  floor?: number; // Этаж

  @Column({ type: 'int', nullable: true })
  apartment?: number; // Квартира

  @Column({ type: 'int', nullable: true })
  maxParticipants?: number; // Максимальное количество людей

  @Column({ type: 'int', nullable: true })
  minAge?: number; // Минимальный возраст участников

  @Column({ type: 'int', nullable: true })
  maxAge?: number; // Максимальный возраст участников

  @Column({ type: 'varchar', length: 20, nullable: true })
  preferredGender?: 'male' | 'female' | 'any'; // Предпочтительный пол участников

  @Column({ type: 'text', nullable: true })
  coverImage?: string; // Заставка события

  @Column({ type: 'int', nullable: true })
  duration?: number; // Длительность события в минутах

  @Column()
  creatorId!: string; // ID создателя события

  @ManyToOne(() => User, user => user.id)
  @JoinColumn({ name: 'creatorId' })
  creator!: User; // Создатель события

  @ManyToMany(() => User)
  @JoinTable({
    name: 'event_participants',
    joinColumn: { name: 'eventId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'userId', referencedColumnName: 'id' }
  })
  participants!: User[]; // Участники события

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

