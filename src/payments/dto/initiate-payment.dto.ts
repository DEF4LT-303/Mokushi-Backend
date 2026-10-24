import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PlanType } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class InitiatePaymentDto {
  @ApiProperty({
    enum: PlanType,
    description: "The plan or bundle to purchase",
    example: PlanType.N5,
  })
  @IsEnum(PlanType)
  planType: PlanType;

  @ApiPropertyOptional({
    description: "Customer contact phone number for SSL Commerz invoice",
    example: "01711111111",
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({
    description: "Customer contact phone number (alternative parameter key)",
    example: "01711111111",
  })
  @IsOptional()
  @IsString()
  cusPhone?: string;

  @ApiPropertyOptional({
    description: "Customer address for invoice",
    example: "Dhaka, Bangladesh",
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: "Customer address for invoice (alternative parameter key)",
    example: "Dhaka, Bangladesh",
  })
  @IsOptional()
  @IsString()
  cusAddress?: string;

  @ApiPropertyOptional({
    description: "Customer city for invoice",
    example: "Dhaka",
  })
  @IsOptional()
  @IsString()
  city?: string;
}
