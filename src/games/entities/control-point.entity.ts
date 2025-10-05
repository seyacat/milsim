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

  @Column({ nullable: true })
  challengeType: string;

  @Column({ nullable: true })
  code: string;

  @Column({ nullable: true })
  armedCode: string;

  @Column({ nullable: true })
  disarmedCode: string;

  @Column({ nullable: true })
  minDistance: number;

  @Column({ nullable: true })
  minAccuracy: number;

  @Column({ default: false })
  hasPositionChallenge: boolean;

  @Column({ default: false })
  hasCodeChallenge: boolean;

  @Column({ default: false })
  hasBombChallenge: boolean;

  @Column({ nullable: true })
  bombTime: number;

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
