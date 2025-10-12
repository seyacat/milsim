import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ControlPoint } from '../entities/control-point.entity';
import { Game } from '../entities/game.entity';
import { Player } from '../entities/player.entity';
import { GameManagementService } from './game-management.service';

@Injectable()
export class ControlPointManagementService {
  constructor(
    @InjectRepository(ControlPoint)
    private controlPointsRepository: Repository<ControlPoint>,
    @InjectRepository(Game)
    private gamesRepository: Repository<Game>,
    @InjectRepository(Player)
    private playersRepository: Repository<Player>,
    private gameManagementService: GameManagementService,
  ) {}

  async createControlPoint(controlPointData: {
    name: string;
    description: string;
    latitude: number;
    longitude: number;
    gameId: number;
    type?: string;
    challengeType?: string;
    code?: string;
    armedCode?: string;
    disarmedCode?: string;
  }): Promise<ControlPoint> {
    // Check if game exists
    const game = await this.gamesRepository.findOne({
      where: { id: controlPointData.gameId },
    });
    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Check if there are any existing Sites in the game
    const existingSite = await this.controlPointsRepository.findOne({
      where: {
        game: { id: controlPointData.gameId },
        type: 'site',
      },
    });

    // If no Site exists, force the new control point to be a Site
    const finalType = existingSite ? controlPointData.type || 'control_point' : 'site';

    // Validate control point type
    const validTypes = ['control_point', 'site', 'bomb'];
    if (finalType && !validTypes.includes(finalType)) {
      throw new ConflictException('Tipo de punto de control inválido');
    }

    // Validate challenge type
    const validChallengeTypes = ['position', 'code'];
    if (
      controlPointData.challengeType &&
      !validChallengeTypes.includes(controlPointData.challengeType)
    ) {
      throw new ConflictException('Tipo de challenge inválido');
    }

    // Check if trying to create a Site and one already exists (should not happen with the logic above, but keeping for safety)
    if (finalType === 'site' && existingSite) {
      throw new ConflictException('Solo puede haber un punto de tipo Site por juego');
    }

    const controlPoint = this.controlPointsRepository.create({
      ...controlPointData,
      type: finalType,
      game: { id: controlPointData.gameId },
    });

    return this.controlPointsRepository.save(controlPoint);
  }

  async updateControlPoint(
    id: number,
    updateData: {
      name?: string;
      type?: string;
      challengeType?: string;
      code?: string;
      armedCode?: string;
      disarmedCode?: string;
      minDistance?: number;
      minAccuracy?: number;
      hasPositionChallenge?: boolean;
      hasCodeChallenge?: boolean;
      hasBombChallenge?: boolean;
      bombTime?: number;
      latitude?: number;
      longitude?: number;
      ownedByTeam?: string | null;
    },
  ): Promise<ControlPoint> {
    const controlPoint = await this.controlPointsRepository.findOne({
      where: { id },
      relations: ['game'],
    });

    if (!controlPoint) {
      throw new NotFoundException('Control point not found');
    }

    // Track if ownership changed for history logging
    const previousTeam = controlPoint.ownedByTeam;
    const newTeam = updateData.ownedByTeam;
    const ownershipChanged = previousTeam !== newTeam;

    // Validate control point type
    const validTypes = ['control_point', 'site', 'bomb'];
    if (updateData.type && !validTypes.includes(updateData.type)) {
      throw new ConflictException('Tipo de punto de control inválido');
    }

    // Validate challenge type
    const validChallengeTypes = ['position', 'code'];
    if (updateData.challengeType && !validChallengeTypes.includes(updateData.challengeType)) {
      throw new ConflictException('Tipo de challenge inválido');
    }

    // Check if trying to change to Site and one already exists
    if (updateData.type === 'site' && controlPoint.type !== 'site') {
      const existingSite = await this.controlPointsRepository.findOne({
        where: {
          game: { id: controlPoint.game.id },
          type: 'site',
        },
      });

      if (existingSite && existingSite.id !== id) {
        throw new ConflictException('Solo puede haber un punto de tipo Site por juego');
      }
    }

    // Update the control point
    // Use save method to handle null values properly
    const controlPointToUpdate = await this.controlPointsRepository.findOne({ where: { id } });
    if (!controlPointToUpdate) {
      throw new NotFoundException('Control point not found');
    }

    // Update the entity with new values
    Object.assign(controlPointToUpdate, updateData);
    await this.controlPointsRepository.save(controlPointToUpdate);

    // Return the updated control point
    const updatedControlPoint = await this.controlPointsRepository.findOne({
      where: { id },
      relations: ['game'],
    });
    if (!updatedControlPoint) {
      throw new NotFoundException('Control point not found after update');
    }

    // Log ownership changes to game history
    if (ownershipChanged && updatedControlPoint.game?.instanceId) {
      await this.gameManagementService.addGameHistory(
        updatedControlPoint.game.instanceId,
        'control_point_taken',
        {
          controlPointId: id,
          controlPointName: updatedControlPoint.name,
          team: newTeam,
          userId: null, // System/owner action
          assignedByOwner: true,
          timestamp: new Date(),
        },
      );

      // Update control point timer with new ownership
      // Note: This will be handled by the timer management service
    }

    return updatedControlPoint;
  }

  async deleteControlPoint(id: number): Promise<void> {
    const controlPoint = await this.controlPointsRepository.findOne({
      where: { id },
    });

    if (!controlPoint) {
      throw new NotFoundException('Control point not found');
    }

    await this.controlPointsRepository.delete(id);
  }

  // Take control point with code validation (for normal control points)
  async takeControlPoint(
    controlPointId: number,
    userId: number,
    code?: string,
  ): Promise<{ controlPoint: ControlPoint }> {
    const controlPoint = await this.controlPointsRepository.findOne({
      where: { id: controlPointId },
      relations: ['game'],
    });

    if (!controlPoint) {
      throw new NotFoundException('Control point not found');
    }

    // Get the player to determine their team
    const player = await this.playersRepository.findOne({
      where: {
        game: { id: controlPoint.game.id },
        user: { id: userId },
      },
      relations: ['user'], // Ensure user relation is loaded
    });

    if (!player) {
      throw new NotFoundException('Player not found in this game');
    }

    if (player.team === 'none' || !player.team) {
      throw new ConflictException('Debes estar asignado a un equipo para tomar puntos de control');
    }

    // Check if code challenge is active and validate code
    if (controlPoint.hasCodeChallenge && controlPoint.code) {
      if (!code || code.trim() !== controlPoint.code) {
        throw new ConflictException('Código incorrecto');
      }
    }

    // Update control point ownership
    controlPoint.ownedByTeam = player.team;
    const updatedControlPoint = await this.controlPointsRepository.save(controlPoint);

    // Add to game history
    if (controlPoint.game.instanceId) {
      await this.gameManagementService.addGameHistory(
        controlPoint.game.instanceId,
        'control_point_taken',
        {
          controlPointId: controlPoint.id,
          controlPointName: controlPoint.name,
          team: player.team,
          userId: userId,
          userName: player.user?.name || 'Unknown Player',
          timestamp: new Date(),
        },
      );

      // Update control point timer with new ownership
      // Note: This will be handled by the timer management service
    }

    return { controlPoint: updatedControlPoint };
  }

  // Get control point with game relation for broadcasting
  async getControlPointWithGame(controlPointId: number): Promise<ControlPoint | null> {
    return this.controlPointsRepository.findOne({
      where: { id: controlPointId },
      relations: ['game'],
    });
  }
}
