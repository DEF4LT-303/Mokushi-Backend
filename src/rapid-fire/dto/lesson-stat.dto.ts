import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RapidFireLessonStatDto {
  @ApiProperty({ description: 'Lesson ID' })
  lessonId: string;

  @ApiProperty({ description: 'Optional lesson title' })
  lessonTitle?: string;

  @ApiProperty({ description: 'Lesson number within the module', example: 1 })
  lessonNumber: number;

  @ApiProperty({ description: 'Total words available for this lesson', example: 15 })
  totalWords: number;

  @ApiProperty({ description: 'Mastery rate for this lesson as a percentage', example: 90 })
  masteryRate: number;

  @ApiProperty({ description: 'Number of words marked as hard for this lesson', example: 4 })
  hardWordCount: number;

  @ApiProperty({ description: 'Total answers submitted for this lesson', example: 18 })
  totalAnswers: number;

  @ApiProperty({ description: 'Total correct answers for this lesson', example: 16 })
  totalCorrect: number;

  @ApiPropertyOptional({ description: 'When this lesson was last practiced', type: String, format: 'date-time' })
  lastPracticed?: string;
}
