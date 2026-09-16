import { ApiProperty } from '@nestjs/swagger';
import { JlptLevel } from '@prisma/client';

export class RapidFireLessonDto {
  @ApiProperty({ description: 'Lesson ID' })
  id!: string;

  @ApiProperty({ description: 'Lesson title' })
  title!: string;

  @ApiProperty({ description: 'Lesson number within the set', example: 1 })
  lessonNumber!: number;

  @ApiProperty({ enum: JlptLevel, description: 'JLPT level for this lesson' })
  jlptLevel!: JlptLevel;
}
