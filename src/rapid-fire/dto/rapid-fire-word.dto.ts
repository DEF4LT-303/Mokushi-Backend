import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { JlptLevel } from "@prisma/client";

export class RapidFireWordDto {
  @ApiProperty({ description: "Rapid fire word ID" })
  id!: string;

  @ApiProperty({ description: "Japanese word" })
  word!: string;

  @ApiProperty({ description: "Japanese reading" })
  reading!: string;

  @ApiProperty({ description: "Romaji reading" })
  romaji!: string;

  @ApiProperty({ description: "English meaning" })
  meaning!: string;

  @ApiPropertyOptional({
    description: "Rapid fire lesson ID this word belongs to",
  })
  rapidFireLessonId?: string;

  @ApiPropertyOptional({
    description: "Whether the user marked this word as hard",
  })
  isHard?: boolean;
}

export class RapidFireWordDetailDto extends RapidFireWordDto {
  @ApiPropertyOptional({ description: "Lesson title" })
  lessonTitle?: string;

  @ApiPropertyOptional({ description: "Lesson number within the set", example: 1 })
  lessonNumber?: number;

  @ApiPropertyOptional({ enum: JlptLevel, description: "JLPT Level" })
  jlptLevel?: JlptLevel;

  @ApiPropertyOptional({ description: "Whether the lesson is premium" })
  isPremium?: boolean;
}

export class ToggleHardWordResponseDto {
  @ApiProperty({ description: "Word ID" })
  wordId!: string;

  @ApiProperty({ description: "Whether the word is currently marked as hard" })
  isHard!: boolean;

  @ApiProperty({ description: "Total number of hard words for the user" })
  totalHardWords!: number;
}
