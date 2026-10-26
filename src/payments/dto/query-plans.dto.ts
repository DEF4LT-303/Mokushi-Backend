import { ApiPropertyOptional } from "@nestjs/swagger";
import { PlanCategory } from "@prisma/client";
import { IsEnum, IsOptional } from "class-validator";

export class QueryPlansDto {
  @ApiPropertyOptional({
    enum: PlanCategory,
    description: "Filter plans by category: CORE_MODULE, RAPID_FIRE, BUNDLE",
    example: PlanCategory.CORE_MODULE,
  })
  @IsOptional()
  @IsEnum(PlanCategory)
  category?: PlanCategory;
}
