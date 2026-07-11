import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';

@Module({
  imports: [DatabaseModule],
  controllers: [LessonsController],
  providers: [LessonsService],
})
export class LessonsModule { }
