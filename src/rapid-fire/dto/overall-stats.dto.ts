import { ApiProperty } from '@nestjs/swagger';
import { JlptLevel } from '@prisma/client';
import { RapidFireLessonDto } from './rapid-fire-lesson.dto';

export class OverallStatsDto {
  @ApiProperty({ enum: JlptLevel, description: 'JLPT level for these overall rapid-fire stats' })
  jlptLevel: JlptLevel;

  @ApiProperty({ type: [RapidFireLessonDto], description: 'Lessons the user has practiced (full lesson objects)' })
  lessonsPracticed: RapidFireLessonDto[];

  @ApiProperty({ description: 'Overall mastery rate as a percentage', example: 75 })
  masteryRate: number;

  @ApiProperty({ description: 'Count of hard words across all lessons', example: 12 })
  totalHardWords: number;

  @ApiProperty({ description: 'Total number of lessons available for this practice set', example: 25 })
  totalLessons: number;

  @ApiProperty({ description: 'Total number of answers submitted across all practice sessions', example: 220 })
  totalAnswers: number;

  @ApiProperty({ description: 'Total number of correct answers across all practice sessions', example: 198 })
  totalCorrect: number;
}
