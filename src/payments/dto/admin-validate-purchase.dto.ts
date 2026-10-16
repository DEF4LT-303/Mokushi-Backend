import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PlanType } from "@prisma/client";
import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class AdminValidatePurchaseDto {
  @ApiProperty({
    description: "Target user ID to grant or validate purchase for",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    enum: PlanType,
    description: "The plan to grant or validate",
    example: PlanType.N5_BUNDLE,
  })
  @IsEnum(PlanType)
  planType: PlanType;

  @ApiPropertyOptional({
    description: "Optional existing transaction ID to mark as SUCCESS",
    example: "MK_1728551234567_1234",
  })
  @IsOptional()
  @IsString()
  tranId?: string;

  @ApiPropertyOptional({
    description: "Admin reason or audit note for manual validation",
    example: "Bank transfer manually verified by admin",
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
