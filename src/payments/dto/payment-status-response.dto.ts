import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PlanCategory, PlanType, TransactionStatus } from "@prisma/client";

export class PaymentStatusPlanDto {
  @ApiProperty({ enum: PlanType, description: "Plan identifier" })
  planType!: PlanType;

  @ApiProperty({ description: "Plan display title" })
  title!: string;

  @ApiProperty({ description: "Plan description" })
  description!: string;

  @ApiPropertyOptional({
    enum: PlanCategory,
    description: "Category of the plan",
  })
  category?: PlanCategory;

  @ApiProperty({ description: "Price in the given currency" })
  price!: number;

  @ApiProperty({ description: "Currency code (default: BDT)" })
  currency!: string;

  @ApiProperty({
    type: [String],
    description: "Features included in this plan",
  })
  features!: string[];
}

export class PaymentStatusCustomerDto {
  @ApiPropertyOptional({
    description: "Customer name (masked if unauthenticated)",
  })
  name?: string | null;

  @ApiPropertyOptional({
    description: "Customer email (masked if unauthenticated)",
  })
  email?: string | null;
}

export class PaymentStatusGatewayDetailsDto {
  @ApiPropertyOptional({ description: "Bank transaction identifier" })
  bankTranId?: string | null;

  @ApiPropertyOptional({
    description: "Card or payment channel type (e.g. BKASH, VISA)",
  })
  cardType?: string | null;

  @ApiPropertyOptional({ description: "Card brand (e.g. VISA, MASTERCARD)" })
  cardBrand?: string | null;

  @ApiPropertyOptional({ description: "Issuing bank or provider" })
  cardIssuer?: string | null;
}

export class PaymentStatusAccessSummaryDto {
  @ApiProperty({ description: "Has access to JLPT N5 modules" })
  hasN5!: boolean;

  @ApiProperty({ description: "Has access to JLPT N4 modules" })
  hasN4!: boolean;

  @ApiProperty({ description: "Has access to JLPT N5 rapid-fire drills" })
  hasRapidFireN5!: boolean;

  @ApiProperty({ description: "Has access to JLPT N4 rapid-fire drills" })
  hasRapidFireN4!: boolean;
}

export class PaymentStatusResponseDto {
  @ApiProperty({
    description: "Transaction identifier",
    example: "MK_1715891234567_4821",
  })
  tranId!: string;

  @ApiPropertyOptional({
    description: "Gateway validation identifier",
    nullable: true,
  })
  valId?: string | null;

  @ApiProperty({
    enum: TransactionStatus,
    description: "Transaction status (SUCCESS, FAILED, CANCELLED, PENDING)",
    example: TransactionStatus.SUCCESS,
  })
  status!: TransactionStatus;

  @ApiProperty({
    description: "Whether transaction was completed successfully",
  })
  isSuccess!: boolean;

  @ApiProperty({ description: "Whether transaction failed" })
  isFailed!: boolean;

  @ApiProperty({ description: "Whether transaction was cancelled" })
  isCancelled!: boolean;

  @ApiProperty({ description: "Whether transaction is pending confirmation" })
  isPending!: boolean;

  @ApiProperty({ description: "Payment amount", example: 499 })
  amount!: number;

  @ApiProperty({ description: "Payment currency", example: "BDT" })
  currency!: string;

  @ApiPropertyOptional({
    description: "Payment method used (e.g. BKASH, VISA, SSLCOMMERZ)",
    nullable: true,
  })
  paymentMethod?: string | null;

  @ApiProperty({ type: PaymentStatusPlanDto, description: "Plan information" })
  plan!: PaymentStatusPlanDto;

  @ApiProperty({
    type: PaymentStatusCustomerDto,
    description: "Customer information",
  })
  customer!: PaymentStatusCustomerDto;

  @ApiProperty({
    description: "User-friendly status message suitable for display on UI",
  })
  message!: string;

  @ApiPropertyOptional({
    description: "Detailed failure or cancellation reason if applicable",
    nullable: true,
  })
  failureReason?: string | null;

  @ApiPropertyOptional({
    type: PaymentStatusGatewayDetailsDto,
    description: "Gateway level details if available",
    nullable: true,
  })
  gatewayDetails?: PaymentStatusGatewayDetailsDto | null;

  @ApiPropertyOptional({
    type: PaymentStatusAccessSummaryDto,
    description: "User's current granted content access summary",
    nullable: true,
  })
  accessSummary?: PaymentStatusAccessSummaryDto | null;

  @ApiPropertyOptional({
    description: "Timestamp when plan was activated",
    nullable: true,
  })
  purchasedAt?: Date | null;

  @ApiProperty({ description: "Transaction initiation timestamp" })
  createdAt!: Date;

  @ApiProperty({ description: "Transaction last updated timestamp" })
  updatedAt!: Date;
}
