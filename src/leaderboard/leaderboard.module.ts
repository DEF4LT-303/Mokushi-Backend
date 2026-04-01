import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';

@Module({
  imports: [DatabaseModule, CacheModule.register()],
  providers: [LeaderboardService],
  controllers: [LeaderboardController],
})
export class LeaderboardModule { }