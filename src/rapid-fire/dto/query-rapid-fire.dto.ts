import { ApiPropertyOptional } from "@nestjs/swagger";
import { JlptLevel } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class QueryRapidFireLessonsDto {
  @ApiPropertyOptional({ enum: JlptLevel, description: "Filter by JLPT level" })
  @IsOptional()
  @IsEnum(JlptLevel)
  jlptLevel?: JlptLevel;

  @ApiPropertyOptional({
    description: "Filter by premium status (true or false)",
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true" || value === true) return true;
    if (value === "false" || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isPremium?: boolean;
}

export class QueryRapidFireWordsDto {
  @ApiPropertyOptional({ enum: JlptLevel, description: "Filter by JLPT level" })
  @IsOptional()
  @IsEnum(JlptLevel)
  jlptLevel?: JlptLevel;

  @ApiPropertyOptional({ description: "Filter by lesson number", example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  lessonNumber?: number;

  @ApiPropertyOptional({
    description: "Search keyword matching word, reading, romaji, or meaning",
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: "Skip number of records", default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @ApiPropertyOptional({
    description: "Take limit of records",
    default: 50,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;
}
