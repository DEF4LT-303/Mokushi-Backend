import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateUserAnswerDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  quizQuestionId: string;

  @ApiProperty()
  @IsString()
  answer: string;

  @ApiProperty()
  @IsBoolean()
  correct: boolean;
}
