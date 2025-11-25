import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { UserAttemptsModule } from 'src/user-attempts/user-attempts.module';
import { ModuleController } from './module.controller';
import { ModuleService } from './module.service';

@Module({
  imports: [DatabaseModule, UserAttemptsModule],
  controllers: [ModuleController],
  providers: [ModuleService],
})
export class ModuleModule { }
