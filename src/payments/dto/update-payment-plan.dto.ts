import { ApiPropertyOptional } from "@nestjs/swagger";
import { PlanCategory } from "@prisma/client";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class UpdatePaymentPlanDto {
  @ApiPropertyOptional({ description: "Plan display title" })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: "Plan description" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: "Price in BDT", example: 499 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ description: "Currency", example: "BDT" })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    enum: PlanCategory,
    description: "Category of the plan (CORE_MODULE, RAPID_FIRE, BUNDLE)",
  })
  @IsOptional()
  @IsEnum(PlanCategory)
  category?: PlanCategory;

  @ApiPropertyOptional({
    description: "Features list for this plan",
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @ApiPropertyOptional({
    description: "Whether the plan is active for purchase",
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
