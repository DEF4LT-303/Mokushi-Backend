import { ApiProperty } from '@nestjs/swagger';
import { JlptLevel } from '@prisma/client';
import { RapidFireLessonStatDto } from './lesson-stat.dto';
import { OverallStatsDto } from './overall-stats.dto';
import { RapidFireWordDto } from './rapid-fire-word.dto';

export class RapidFireLessonOverviewDto {
  @ApiProperty({ description: 'Lesson ID' })
  lessonId: string;

  @ApiProperty({ description: 'Lesson title' })
  lessonTitle: string;

  @ApiProperty({ description: 'Lesson number within the module', example: 1 })
  lessonNumber: number;

  @ApiProperty({ enum: JlptLevel, description: 'JLPT level associated with the lesson' })
  jlptLevel: JlptLevel;

  @ApiProperty({ type: [RapidFireWordDto], description: 'Rapid-fire word bank for the lesson' })
  words: RapidFireWordDto[];

  @ApiProperty({ type: RapidFireLessonStatDto, description: 'Lesson-specific rapid-fire statistics' })
  lessonStat: RapidFireLessonStatDto;

  @ApiProperty({ type: OverallStatsDto, description: 'Overall rapid-fire progress for the current user and JLPT level' })
  overallStat: OverallStatsDto;
}
