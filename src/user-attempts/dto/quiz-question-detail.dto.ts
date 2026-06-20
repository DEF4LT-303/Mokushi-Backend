import { ApiProperty } from '@nestjs/swagger';

export class QuizQuestionDetailDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  content!: string;

  @ApiProperty({ type: [String] })
  options!: string[];

  @ApiProperty()
  correctAnswer!: string;

  @ApiProperty()
  explanation?: string;

  @ApiProperty()
  questionType!: string;
}

export class QuizResultItemDto {
  @ApiProperty({ description: 'QuizQuestion ID' })
  quizQuestionId!: string;

  @ApiProperty({ type: QuizQuestionDetailDto })
  question!: QuizQuestionDetailDto;

  @ApiProperty({ description: 'Answer provided by user' })
  userAnswer!: string | null;

  @ApiProperty({ description: 'Correct answer' })
  correctAnswer!: string;

  @ApiProperty({ description: 'Whether the answer was correct' })
  isCorrect!: boolean;
}
