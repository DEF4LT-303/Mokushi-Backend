
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CategoryType, JlptLevel } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class QuizConfigInputDto {
  @ApiProperty({ description: 'Name of the quiz configuration (e.g., "10 Questions - 5 Minutes")' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Number of questions for this quiz configuration' })
  @IsInt()
  @Min(1)
  numQuestions!: number;

  @ApiProperty({ description: 'Duration in seconds (e.g., 300 for 5 minutes)' })
  @IsInt()
  @Min(1)
  durationSec!: number;
}

export class CreateModuleDto {
  @ApiProperty({ description: 'Unique slug for the module' })
  @IsString()
  slug!: string;

  @ApiProperty({ description: 'Name of the module' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Description of the module' })
  @IsString()
  description!: string;

  @ApiProperty({ description: 'Learning objectives for the module' })
  @IsArray()
  @IsString({ each: true })
  learningObjectives!: string[];

  @ApiProperty({ description: 'Instructions for the module' })
  @IsArray()
  @IsString({ each: true })
  instructions!: string[];

  @ApiProperty({ description: 'Rules for the module' })
  @IsArray()
  @IsString({ each: true })
  rules!: string[];

  @ApiProperty({ description: 'Motivational quote' })
  @IsString()
  motivationalQuote!: string;

  @ApiProperty({ enum: JlptLevel, description: 'JLPT level for the module' })
  @IsEnum(JlptLevel)
  jlptLevel!: JlptLevel;

  @ApiProperty({ enum: CategoryType, description: 'Type of the module' })
  @IsEnum(CategoryType)
  categoryType!: CategoryType;

  @ApiPropertyOptional({
    description: 'Optional array of quiz configurations to create with this module',
    type: [QuizConfigInputDto]
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuizConfigInputDto)
  quizConfigs?: QuizConfigInputDto[];
}
