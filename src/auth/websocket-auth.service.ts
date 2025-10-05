import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import { AuthService } from './auth.service';

@Injectable()
export class WebsocketAuthService {
  constructor(private readonly authService: AuthService) {}

  async validateToken(token: string): Promise<any> {
    if (!token) {
      console.error('Token not provided');
      throw new Error('Token not provided');
    }

    try {
      // Use the actual auth service to validate the token
      const user = await this.authService.validateToken(token);
      return user;
    } catch (error) {
      console.error('Token validation failed:', error);
      console.error('Error details:', error.message, error.stack);
      throw new Error('Invalid token: ' + error.message);
    }
  }

  async authenticateSocket(client: Socket): Promise<any> {
    const token = client.handshake.auth.token || client.handshake.headers.authorization;

    if (!token) {
      throw new Error('Authentication token not provided');
    }

    const user = await this.validateToken(token);
    return user;
  }
}
