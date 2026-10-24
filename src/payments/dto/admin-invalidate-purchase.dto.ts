import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PlanType } from "@prisma/client";
import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class AdminInvalidatePurchaseDto {
  @ApiProperty({
    description: "Target user ID to invalidate purchase for",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    enum: PlanType,
    description: "The plan to invalidate or revoke",
    example: PlanType.N5,
  })
  @IsEnum(PlanType)
  planType: PlanType;

  @ApiPropertyOptional({
    description: "Admin reason or audit note for revocation",
    example: "Requested refund / chargeback",
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
