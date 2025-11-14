
import { ApiProperty } from '@nestjs/swagger';
import { CategoryType, JlptLevel } from '@prisma/client';
import { IsArray, IsEnum, IsObject, IsString } from 'class-validator';

export class CreateModuleDto {
  @ApiProperty({ description: 'Unique slug for the module' })
  @IsString()
  slug: string;

  @ApiProperty({ description: 'Name of the module' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Description of the module' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Learning objectives for the module' })
  @IsArray()
  @IsString({ each: true })
  learningObjectives: string[];

  @ApiProperty({ description: 'Instructions for the module' })
  @IsObject()
  instructions: Record<string, any>;

  @ApiProperty({ description: 'Motivational quote' })
  @IsString()
  motivationalQuote: string;

  @ApiProperty({ enum: JlptLevel, description: 'JLPT level for the module' })
  @IsEnum(JlptLevel)
  jlptLevel: JlptLevel;

  @ApiProperty({ enum: CategoryType, description: 'Type of the module' })
  @IsEnum(CategoryType)
  categoryType: CategoryType;
}
