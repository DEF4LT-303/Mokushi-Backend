import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { ModuleController } from './module.controller';
import { ModuleService } from './module.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ModuleController],
  providers: [ModuleService],
})
export class ModuleModule { }
