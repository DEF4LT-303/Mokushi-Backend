import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsString, ValidateNested } from 'class-validator';

class RapidFireAnswerDto {
  @ApiProperty({ description: 'Rapid-fire word ID that was answered' })
  @IsString()
  wordId!: string;

  @ApiProperty({ description: 'Whether the answer was correct' })
  @IsBoolean()
  isCorrect!: boolean;

  @ApiProperty({ description: 'Whether the word was marked as hard' })
  @IsBoolean()
  isHard!: boolean;
}

export class SubmitRapidFireAnswersDto {
  @ApiProperty({ type: [RapidFireAnswerDto], description: 'Answers submitted for the lesson' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RapidFireAnswerDto)
  answers!: RapidFireAnswerDto[];
}
