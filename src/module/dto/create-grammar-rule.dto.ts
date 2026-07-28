import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

export class CreateGrammarExampleDto {
  @ApiProperty({ description: 'Japanese sentence example' })
  @IsString()
  japaneseSentence!: string;

  @ApiProperty({ description: 'English translation of the example' })
  @IsString()
  englishTranslation!: string;
}

export class CreateGrammarRuleDto {
  @ApiProperty({ description: 'Japanese grammar expression or sentence' })
  @IsString()
  japanese!: string;

  @ApiPropertyOptional({ description: 'Romaji reading of the grammar expression' })
  @IsOptional()
  @IsString()
  romaji?: string;

  @ApiProperty({ description: 'English title of the grammar rule' })
  @IsString()
  englishTitle!: string;

  @ApiProperty({ description: 'Explanation of how the grammar rule is used' })
  @IsString()
  description!: string;

  @ApiPropertyOptional({ description: 'Optional structure pattern for the rule' })
  @IsOptional()
  @IsString()
  structurePattern?: string;

  @ApiPropertyOptional({ description: 'Optional notes about usage' })
  @IsOptional()
  @IsString()
  usageNotes?: string;

  @ApiPropertyOptional({ description: 'Optional examples to create with the grammar rule', type: [CreateGrammarExampleDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGrammarExampleDto)
  examples?: CreateGrammarExampleDto[];
}
