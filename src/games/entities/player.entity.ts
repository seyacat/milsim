import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
  Column,
} from 'typeorm';
import { Game } from './game.entity';
import { User } from '../../auth/entities/user.entity';

@Entity('players')
export class Player {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Game, game => game.players)
  @JoinColumn({ name: 'gameId' })
  game: Game;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn()
  joinedAt: Date;

  @Column({ nullable: true })
  team: string; // 'blue', 'red', 'green', 'yellow', or 'none' for no team
}
