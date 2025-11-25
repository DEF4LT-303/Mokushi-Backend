import { ApiProperty } from '@nestjs/swagger';
import { QuizQuestionResponseDto } from './quiz-question-response.dto';

export class QuizResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  jlptLevel: string;

  @ApiProperty()
  questionCount: number;

  @ApiProperty({ type: [QuizQuestionResponseDto] })
  questions: QuizQuestionResponseDto[];
}
