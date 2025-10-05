import { Controller, Get, Res, Inject } from '@nestjs/common';
import { AppService } from './app.service';
import type { Response } from 'express';
import { ConnectionTrackerService } from './connection-tracker.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @Inject(ConnectionTrackerService) private readonly connectionTracker: ConnectionTrackerService,
  ) {}

  @Get()
  getHello(@Res() res: Response) {
    // Redirect root path to login page
    return res.redirect('/login.html');
  }

  @Get('uptime')
  getUptime() {
    return this.connectionTracker.getUptimeInfo();
  }

  @Get('connection')
  registerConnection() {
    this.connectionTracker.registerConnection();
    return {
      message: 'Connection registered',
      timestamp: new Date().toISOString(),
    };
  }
}
