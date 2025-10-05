import { Module, Global } from '@nestjs/common';
import { ConnectionTrackerService } from '../connection-tracker.service';

@Global()
@Module({
  providers: [ConnectionTrackerService],
  exports: [ConnectionTrackerService],
})
export class SharedModule {}