import { ApiProperty } from '@nestjs/swagger';

export class QuizHistoryTableItemDto {
  @ApiProperty({ description: 'User attempt ID' })
  id!: string;

  @ApiProperty({ description: 'Quiz category (GRAMMAR, VOCABULARY, LISTENING)' })
  category!: string;

  @ApiProperty({ description: 'ISO formatted date string' })
  date!: string;

  @ApiProperty({ description: 'Score achieved' })
  score!: number;

  @ApiProperty({ description: 'Total questions in quiz' })
  totalQuestions!: number;

  @ApiProperty({ description: 'Time taken in seconds' })
  timeTaken!: number;

  @ApiProperty({ description: 'Performance label based on score', enum: ['EXCELLENT', 'GOOD', 'AVERAGE', 'NEEDS WORK', 'N/A'] })
  performance!: string;
}
