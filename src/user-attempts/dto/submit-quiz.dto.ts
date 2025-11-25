import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsString, IsUUID, ValidateNested } from 'class-validator';

class SubmitAnswerDto {
  @ApiProperty({ description: 'QuizQuestion id (UUID)' })
  @IsNotEmpty()
  @IsUUID()
  quizQuestionId: string;

  @ApiProperty({ description: 'Answer text chosen by the user' })
  @IsString()
  answer: string;
}

export class SubmitQuizDto {
  @ApiProperty({ description: 'User attempt id to which the answers belong' })
  @IsNotEmpty()
  @IsUUID()
  userAttemptId: string;

  @ApiProperty({ type: [SubmitAnswerDto], description: 'Array of answers for this attempt' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitAnswerDto)
  answers: SubmitAnswerDto[];
}
