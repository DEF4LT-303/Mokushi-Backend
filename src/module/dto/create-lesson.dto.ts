import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Min } from 'class-validator';

export class CreateLessonDto {
  @ApiProperty({ description: 'Title of the lesson' })
  @IsString()
  title!: string;

  @ApiProperty({ description: 'Lesson number within the module' })
  @IsInt()
  @Min(1)
  lessonNumber!: number;
}
