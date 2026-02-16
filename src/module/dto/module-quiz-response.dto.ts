import { ApiProperty } from '@nestjs/swagger';
import { QuizResponseDto } from './quiz-response.dto';

export class ModuleInfoDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  jlptLevel!: string;

  @ApiProperty()
  categoryType!: string;
}

export class ModuleQuizResponseDto {
  @ApiProperty({ type: ModuleInfoDto })
  module!: ModuleInfoDto;

  @ApiProperty({ type: QuizResponseDto })
  quiz!: QuizResponseDto;
}
