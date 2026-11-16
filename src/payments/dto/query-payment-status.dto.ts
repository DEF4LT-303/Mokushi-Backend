import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class QueryPaymentStatusDto {
  @ApiPropertyOptional({
    description:
      "Transaction ID returned in redirect query params (e.g. MK_1715891234567_4821)",
    example: "MK_1715891234567_4821",
  })
  @IsOptional()
  @IsString()
  tran_id?: string;

  @ApiPropertyOptional({
    description: "Alternative camelCase parameter for transaction ID",
    example: "MK_1715891234567_4821",
  })
  @IsOptional()
  @IsString()
  tranId?: string;
}
