import { Module } from '@nestjs/common';
import { CacheService } from 'src/common/services/cache.service';
import { DatabaseModule } from 'src/database/database.module';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardGateway } from './leaderboard.gateway';
import { LeaderboardService } from './leaderboard.service';

@Module({
  imports: [DatabaseModule],
  providers: [
    CacheService,
    LeaderboardService,
    LeaderboardGateway,
  ],
  controllers: [LeaderboardController],
  exports: [LeaderboardService],
})
export class LeaderboardModule { }