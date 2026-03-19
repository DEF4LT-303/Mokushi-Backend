import { Module } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { RedisModule } from 'src/redis.module';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';

@Module({
  imports: [RedisModule],
  providers: [LeaderboardService, DatabaseService],
  controllers: [LeaderboardController],
})
export class LeaderboardModule { }