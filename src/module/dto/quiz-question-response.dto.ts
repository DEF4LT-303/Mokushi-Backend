import { ApiProperty } from '@nestjs/swagger';

export class QuizQuestionResponseDto {
  @ApiProperty({ description: 'quizQuestion id' })
  quizQuestionId: string;

  @ApiProperty({ description: 'question id' })
  questionId: string;

  @ApiProperty({ description: 'order number in quiz' })
  order: number;

  @ApiProperty({ description: 'question text' })
  content: string;

  @ApiProperty({ type: [String], description: 'answer options' })
  options: string[];

  @ApiProperty({ required: false })
  explanation?: string;
}
