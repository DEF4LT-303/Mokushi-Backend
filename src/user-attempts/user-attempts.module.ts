import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { UserAttemptsController } from './user-attempts.controller';
import { UserAttemptsService } from './user-attempts.service';

@Module({
  imports: [DatabaseModule, CacheModule.register()],
  controllers: [UserAttemptsController],
  providers: [UserAttemptsService],
  exports: [UserAttemptsService]
})
export class UserAttemptsModule { }
