import { ApiProperty } from '@nestjs/swagger';
import { RapidFireLessonStatDto } from './lesson-stat.dto';
import { OverallStatsDto } from './overall-stats.dto';

export class SubmitRapidFireAnswersResponseDto {
  @ApiProperty({ type: RapidFireLessonStatDto, description: 'Updated lesson rapid-fire statistics' })
  updatedLesson!: RapidFireLessonStatDto;

  @ApiProperty({ type: OverallStatsDto, description: 'Updated overall rapid-fire statistics' })
  updatedOverall!: OverallStatsDto;
}
