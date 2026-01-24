import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class CreateQuizConfigDto {
  @ApiProperty({ description: 'Name of the quiz configuration (e.g., "10 Questions - 5 Minutes")' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Number of questions for this quiz configuration' })
  @IsInt()
  @Min(1)
  numQuestions: number;

  @ApiProperty({ description: 'Duration in seconds (e.g., 300 for 5 minutes)' })
  @IsInt()
  @Min(1)
  durationSec: number;
}


