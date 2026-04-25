import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { LeaderboardModule } from 'src/leaderboard/leaderboard.module';
import { UserAttemptsController } from './user-attempts.controller';
import { UserAttemptsService } from './user-attempts.service';

@Module({
  imports: [DatabaseModule, LeaderboardModule],
  controllers: [UserAttemptsController],
  providers: [UserAttemptsService],
  exports: [UserAttemptsService]
})
export class UserAttemptsModule { }
