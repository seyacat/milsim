import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Player } from './player.entity';
import { User } from '../../auth/entities/user.entity';
import { ControlPoint } from './control-point.entity';

@Entity('games')
export class Game {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: 'stopped' })
  status: string; // stopped, running, paused

  @Column({ default: 10 })
  maxPlayers: number;

  @Column({ default: 2 })
  teamCount: number; // Number of teams (2, 3, or 4)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @OneToMany(() => Player, player => player.game)
  players: Player[];

  @OneToMany(() => ControlPoint, controlPoint => controlPoint.game)
  controlPoints: ControlPoint[];
}
