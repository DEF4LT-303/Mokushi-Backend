import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { JlptLevel } from "@prisma/client";

export class RapidFireLessonDto {
  @ApiProperty({ description: "Lesson ID" })
  id!: string;

  @ApiProperty({ description: "Lesson title" })
  title!: string;

  @ApiProperty({ description: "Lesson number within the set", example: 1 })
  lessonNumber!: number;

  @ApiProperty({ enum: JlptLevel, description: "JLPT level for this lesson" })
  jlptLevel!: JlptLevel;

  @ApiProperty({
    description: "Whether this lesson is premium",
    example: false,
  })
  isPremium!: boolean;

  @ApiPropertyOptional({
    description: "Total vocabulary words in this lesson",
    example: 34,
  })
  wordCount?: number;

  @ApiPropertyOptional({
    description: "Whether the requesting user has access to this lesson",
    example: true,
  })
  isUnlocked?: boolean;
}
