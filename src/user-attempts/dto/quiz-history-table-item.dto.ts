import { ApiProperty } from "@nestjs/swagger";
import { UserAttemptStatus } from "@prisma/client";

export class QuizHistoryTableItemDto {
  @ApiProperty({ description: "User attempt ID" })
  id!: string;

  @ApiProperty({
    description: "Quiz category (GRAMMAR, VOCABULARY, LISTENING)",
  })
  category!: string;

  @ApiProperty({
    description: "Status of the quiz attempt",
    enum: ["COMPLETED", "CANCELLED", "ONGOING"],
  })
  status!: UserAttemptStatus | string;

  @ApiProperty({ description: "ISO formatted date string" })
  date!: string;

  @ApiProperty({ description: "Score achieved" })
  score!: number;

  @ApiProperty({ description: "Total questions in quiz" })
  totalQuestions!: number;

  @ApiProperty({ description: "Time taken in seconds" })
  timeTaken!: number;

  @ApiProperty({
    description: "Performance label based on score",
    enum: [
      "EXCELLENT",
      "GOOD",
      "AVERAGE",
      "POOR",
      "NEEDS WORK",
      "CANCELLED",
      "N/A",
    ],
  })
  performance!: string;
}
