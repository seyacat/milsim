import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Game } from './game.entity';

@Entity('control_points')
export class ControlPoint {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column('text', { nullable: true })
  description: string;

  @Column('decimal', { precision: 10, scale: 8 })
  latitude: number;

  @Column('decimal', { precision: 11, scale: 8 })
  longitude: number;

  @Column({ default: 'active' })
  status: string;

  @Column({ default: 'control_point' })
  type: string;

  @ManyToOne(() => Game, game => game.controlPoints, {
    onDelete: 'CASCADE',
  })
  game: Game;

  @Column()
  gameId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
