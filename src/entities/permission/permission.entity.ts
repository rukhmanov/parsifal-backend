import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToMany, JoinTable } from 'typeorm';
import { Role } from '../role/role.entity';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  name!: string;

  @Column()
  description!: string;

  @Column({ unique: true })
  code!: string; // Например: 'users.view', 'users.edit', 'users.create', 'users.delete'

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Связь ManyToMany с Role через промежуточную таблицу
  // Примечание: Role использует permissionCodes (массив строк) вместо прямой связи
  @ManyToMany(() => Role)
  @JoinTable({
    name: 'role_permissions',
    joinColumn: { name: 'permissionId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'roleId', referencedColumnName: 'id' }
  })
  roles!: Role[];
}
