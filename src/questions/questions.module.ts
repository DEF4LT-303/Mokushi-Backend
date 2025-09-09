import { Module } from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { QuestionsController } from './questions.controller';
import { DatabaseModule } from 'src/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [QuestionsController],
  providers: [QuestionsService],
  exports: [QuestionsService]
})
export class QuestionsModule {}


