import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class GenerateQuestionsDto {
  @ApiProperty({
    description: 'The ID of the lesson to generate questions for',
    example: 'a1b2c3d4-...'
  })
  @IsString()
  @IsNotEmpty()
  lessonId!: string;

  @ApiProperty({
    description: 'Number of questions to generate',
    example: 5,
    minimum: 1
  })
  @IsInt()
  @Min(1)
  count!: number;
}
