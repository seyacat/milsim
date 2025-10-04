import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { GameInstance } from './game-instance.entity';

@Entity('game_history')
export class GameHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  eventType: string; // e.g., 'game_started', 'game_paused', 'game_ended', 'player_joined', 'control_point_captured', etc.

  @Column({ type: 'json', nullable: true })
  data: any; // Additional event data

  @CreateDateColumn()
  timestamp: Date;

  @ManyToOne(() => GameInstance)
  @JoinColumn({ name: 'gameInstanceId' })
  gameInstance: GameInstance;
}