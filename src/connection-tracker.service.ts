import { Injectable } from '@nestjs/common';

@Injectable()
export class ConnectionTrackerService {
  private lastConnectionTime: Date = new Date();
  private activeConnectionsCount: number = 0;

  registerConnection() {
    this.lastConnectionTime = new Date();
    this.activeConnectionsCount++;
  }

  unregisterConnection() {
    this.activeConnectionsCount = Math.max(0, this.activeConnectionsCount - 1);
  }

  getActiveConnectionsCount(): number {
    return this.activeConnectionsCount;
  }

  getUptimeInfo() {
    const now = new Date();
    const hasActiveConnections = this.activeConnectionsCount > 0;

    let timeWithoutConnections = 0;

    if (!hasActiveConnections) {
      timeWithoutConnections = Math.floor(
        (now.getTime() - this.lastConnectionTime.getTime()) / 1000,
      );
    }


    return {
      lastConnectionTime: this.lastConnectionTime.toISOString(),
      timeWithoutConnections: timeWithoutConnections,
      timeWithoutConnectionsFormatted: this.formatTime(timeWithoutConnections),
      currentTime: now.toISOString(),
      hasActiveConnections: hasActiveConnections,
      activeConnectionsCount: this.activeConnectionsCount,
    };
  }

  private formatTime(seconds: number): string {
    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m ${secs}s`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }
}
