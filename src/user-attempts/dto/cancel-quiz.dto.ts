import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsUUID } from "class-validator";

export class CancelQuizDto {
  @ApiProperty({ description: "User attempt id to be cancelled" })
  @IsNotEmpty()
  @IsUUID()
  userAttemptId!: string;
}
