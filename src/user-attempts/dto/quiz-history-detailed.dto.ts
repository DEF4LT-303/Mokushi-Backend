import { ApiProperty } from '@nestjs/swagger';
import { QuizResultItemDto } from './quiz-question-detail.dto';

export class QuizHistorySubmissionDto {
  @ApiProperty({ description: 'Score achieved' })
  score!: number;

  @ApiProperty({ description: 'Total questions in quiz' })
  totalQuestions!: number;

  @ApiProperty({ description: 'Time taken in seconds' })
  timeTaken!: number;

  @ApiProperty({ type: [QuizResultItemDto], description: 'Detailed results for each question' })
  results!: QuizResultItemDto[];
}

export class QuizHistoryDetailedDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: QuizHistorySubmissionDto })
  submission!: QuizHistorySubmissionDto;

  @ApiProperty({ description: 'ISO date string' })
  date!: Date;
}
