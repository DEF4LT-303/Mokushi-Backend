import { ApiProperty } from '@nestjs/swagger';
import { QuestionType } from '@prisma/client';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateQuestionDto {

  @ApiProperty({ description: 'The main content or text of the question.' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  content: string;


  @ApiProperty({ type: [String], description: 'List of possible answer options for the question.' })
  @IsArray()
  @IsString({ each: true })
  options: string[];


  @ApiProperty({ description: 'The correct answer for the question.' })
  @IsString()
  @IsNotEmpty()
  correctAnswer: string;


  @ApiProperty({ required: false, description: 'Optional explanation for the correct answer.' })
  @IsOptional()
  @IsString()
  explanation?: string;


  @ApiProperty({ enum: QuestionType, description: 'Type of the question' })
  @IsEnum(QuestionType)
  questionType: QuestionType;

  @ApiProperty({ description: 'UUID of the module this question belongs to.' })
  @IsUUID()
  moduleId: string;
}


