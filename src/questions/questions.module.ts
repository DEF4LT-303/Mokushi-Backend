import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { QuestionGenerationController } from './generate.controller';
import { QuestionGenerationService } from './question-generation.service';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';

@Module({
  imports: [DatabaseModule],
  controllers: [QuestionsController, QuestionGenerationController],
  providers: [QuestionsService, QuestionGenerationService],
  exports: [QuestionsService]
})
export class QuestionsModule { }


