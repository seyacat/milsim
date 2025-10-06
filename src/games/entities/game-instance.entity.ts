import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Game } from './game.entity';
import { GameHistory } from './game-history.entity';

@Entity('game_instances')
export class GameInstance {
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

  @Column({ type: 'int', nullable: true })
  totalTime: number | null; // Total game time in seconds (null for unlimited)

  @Column({ type: 'timestamp', nullable: true })
  gameStartTime: Date | null; // When the game actually started

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Game, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'gameId' })
  game: Game;

  @OneToMany(() => GameHistory, gameHistory => gameHistory.gameInstance)
  history: GameHistory[];
}
