import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { SkipThrottle, Throttle } from "@nestjs/throttler";
import { PlanType, Role, TransactionStatus } from "@prisma/client";
import { Response } from "express";
import { CurrentUser } from "src/auth/decorators/current-user.decorator";
import { Roles } from "src/auth/decorators/roles.decorator";
import { JwtGuard } from "src/auth/guards/jwt.guard";
import { RolesGuard } from "src/auth/guards/roles.guard";
import { AdminInvalidatePurchaseDto } from "./dto/admin-invalidate-purchase.dto";
import { AdminValidatePurchaseDto } from "./dto/admin-validate-purchase.dto";
import { InitiatePaymentDto } from "./dto/initiate-payment.dto";
import { PaymentsService } from "./payments.service";

@ApiTags("Payments")
@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get("plans")
  @ApiOperation({ summary: "Get all available purchase plans and pricing" })
  @ApiResponse({
    status: 200,
    description: "List of plans returned successfully",
  })
  getPlans() {
    return this.paymentsService.getAvailablePlans();
  }

  @Post("initiate")
  @UseGuards(JwtGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: "Initiate payment session for a plan" })
  @ApiResponse({
    status: 201,
    description: "Payment session initiated, returns SSL Commerz gateway URL",
  })
  async initiatePayment(
    @CurrentUser() user: any,
    @Body() dto: InitiatePaymentDto,
  ) {
    const userId = user.id || user.userId;
    return this.paymentsService.initiatePayment(userId, dto);
  }

  @Post("success")
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "SSL Commerz redirect endpoint on payment success" })
  async handleSuccess(
    @Body() body: Record<string, any>,
    @Res() res: Response,
    @Query() query?: Record<string, any>,
  ) {
    const tranId = body?.tran_id || query?.tran_id;
    const valId = body?.val_id || query?.val_id;
    const cardType = body?.card_type || query?.card_type;

    const fulfilled = await this.paymentsService.validateAndFulfillPayment(
      valId,
      tranId,
      cardType,
    );

    const redirectUrl = this.paymentsService.getFrontendRedirectUrl(
      fulfilled ? "success" : "failed",
      tranId,
    );
    return res.redirect(redirectUrl);
  }

  @Get("success")
  @SkipThrottle()
  @ApiOperation({
    summary: "SSL Commerz GET redirect fallback on payment success",
  })
  async handleSuccessGet(
    @Res() res: Response,
    @Query() query?: Record<string, any>,
  ) {
    return this.handleSuccess({}, res, query);
  }

  @Post("fail")
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "SSL Commerz redirect endpoint on payment failure" })
  async handleFail(
    @Body() body: Record<string, any>,
    @Res() res: Response,
    @Query() query?: Record<string, any>,
  ) {
    const tranId = body?.tran_id || query?.tran_id;
    await this.paymentsService.handlePaymentFailure(tranId);

    const redirectUrl = this.paymentsService.getFrontendRedirectUrl(
      "failed",
      tranId,
    );
    return res.redirect(redirectUrl);
  }

  @Get("fail")
  @SkipThrottle()
  @ApiOperation({
    summary: "SSL Commerz GET redirect fallback on payment failure",
  })
  async handleFailGet(
    @Res() res: Response,
    @Query() query?: Record<string, any>,
  ) {
    return this.handleFail({}, res, query);
  }

  @Post("cancel")
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "SSL Commerz redirect endpoint on payment cancellation",
  })
  async handleCancel(
    @Body() body: Record<string, any>,
    @Res() res: Response,
    @Query() query?: Record<string, any>,
  ) {
    const tranId = body?.tran_id || query?.tran_id;
    await this.paymentsService.handlePaymentCancel(tranId);

    const redirectUrl = this.paymentsService.getFrontendRedirectUrl(
      "cancelled",
      tranId,
    );
    return res.redirect(redirectUrl);
  }

  @Get("cancel")
  @SkipThrottle()
  @ApiOperation({
    summary: "SSL Commerz GET redirect fallback on payment cancellation",
  })
  async handleCancelGet(
    @Res() res: Response,
    @Query() query?: Record<string, any>,
  ) {
    return this.handleCancel({}, res, query);
  }

  @Post("ipn")
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "SSL Commerz Instant Payment Notification (IPN) webhook",
  })
  async handleIpn(
    @Body() body: Record<string, any>,
    @Query() query?: Record<string, any>,
  ) {
    const data = { ...query, ...body };
    const tranId = data?.tran_id;
    const valId = data?.val_id;
    const cardType = data?.card_type;
    const status = data?.status?.toUpperCase();

    if (status === "VALID" || status === "VALIDATED") {
      await this.paymentsService.validateAndFulfillPayment(
        valId,
        tranId,
        cardType,
      );
    } else if (status === "FAILED") {
      await this.paymentsService.handlePaymentFailure(tranId);
    } else if (status === "CANCELLED") {
      await this.paymentsService.handlePaymentCancel(tranId);
    }

    return { message: "IPN received successfully" };
  }

  @Get("my-purchases")
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user's purchased plans" })
  async getMyPurchases(@CurrentUser() user: any) {
    const userId = user.id || user.userId;
    return this.paymentsService.getUserPurchases(userId);
  }

  @Get("my-transactions")
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user's payment transaction history" })
  async getMyTransactions(@CurrentUser() user: any) {
    const userId = user.id || user.userId;
    return this.paymentsService.getUserTransactions(userId);
  }

  // ================= ADMIN ENDPOINTS =================

  @Get("admin/subscriptions")
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Admin: View all user subscriptions with filtering and pagination",
  })
  @ApiOkResponse({ description: "Subscriptions list returned successfully" })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiForbiddenResponse({ description: "Forbidden - Admin access required" })
  @ApiQuery({ name: "skip", required: false, type: Number })
  @ApiQuery({ name: "take", required: false, type: Number })
  @ApiQuery({ name: "userId", required: false, type: String })
  @ApiQuery({ name: "planType", required: false, enum: PlanType })
  @ApiQuery({
    name: "search",
    required: false,
    type: String,
    description: "Search by user email or name",
  })
  async adminGetSubscriptions(
    @Query("skip") skip?: string,
    @Query("take") take?: string,
    @Query("userId") userId?: string,
    @Query("planType") planType?: PlanType,
    @Query("search") search?: string,
  ) {
    return this.paymentsService.adminGetSubscriptions({
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
      userId,
      planType,
      search,
    });
  }

  @Get("admin/users/:userId/subscriptions")
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Admin: Get specific user's active subscriptions, transactions, and access summary",
  })
  @ApiOkResponse({
    description: "User subscription details returned successfully",
  })
  @ApiNotFoundResponse({ description: "User not found" })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiForbiddenResponse({ description: "Forbidden - Admin access required" })
  async adminGetUserSubscriptions(@Param("userId") userId: string) {
    return this.paymentsService.adminGetUserSubscriptions(userId);
  }

  @Get("admin/transactions")
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Admin: View all payment transactions with filtering and pagination",
  })
  @ApiOkResponse({ description: "Transactions list returned successfully" })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiForbiddenResponse({ description: "Forbidden - Admin access required" })
  @ApiQuery({ name: "skip", required: false, type: Number })
  @ApiQuery({ name: "take", required: false, type: Number })
  @ApiQuery({ name: "userId", required: false, type: String })
  @ApiQuery({ name: "status", required: false, enum: TransactionStatus })
  async adminGetAllTransactions(
    @Query("skip") skip?: string,
    @Query("take") take?: string,
    @Query("userId") userId?: string,
    @Query("status") status?: TransactionStatus,
  ) {
    return this.paymentsService.adminGetAllTransactions({
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
      userId,
      status,
    });
  }

  @Post("admin/validate")
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Admin: Validate or grant a plan purchase for a user",
  })
  @ApiOkResponse({ description: "Purchase successfully validated/granted" })
  @ApiNotFoundResponse({ description: "User or transaction not found" })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiForbiddenResponse({ description: "Forbidden - Admin access required" })
  async adminValidatePurchase(
    @CurrentUser() admin: any,
    @Body() dto: AdminValidatePurchaseDto,
  ) {
    const adminId = admin?.id || admin?.userId;
    return this.paymentsService.adminValidatePurchase(dto, adminId);
  }

  @Post("admin/invalidate")
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Admin: Invalidate or revoke a plan purchase from a user",
  })
  @ApiOkResponse({ description: "Purchase successfully invalidated/revoked" })
  @ApiNotFoundResponse({
    description: "User not found or has no active purchase for this plan",
  })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiForbiddenResponse({ description: "Forbidden - Admin access required" })
  async adminInvalidatePurchase(
    @CurrentUser() admin: any,
    @Body() dto: AdminInvalidatePurchaseDto,
  ) {
    const adminId = admin?.id || admin?.userId;
    return this.paymentsService.adminInvalidatePurchase(dto, adminId);
  }

  @Get("admin/audit-logs")
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Admin: View payment and entitlement audit logs with pagination and filters",
  })
  @ApiOkResponse({ description: "Audit logs returned successfully" })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiForbiddenResponse({ description: "Forbidden - Admin access required" })
  @ApiQuery({ name: "skip", required: false, type: Number })
  @ApiQuery({ name: "take", required: false, type: Number })
  @ApiQuery({ name: "adminId", required: false, type: String })
  @ApiQuery({ name: "targetId", required: false, type: String })
  @ApiQuery({ name: "action", required: false, type: String })
  async adminGetAuditLogs(
    @Query("skip") skip?: string,
    @Query("take") take?: string,
    @Query("adminId") adminId?: string,
    @Query("targetId") targetId?: string,
    @Query("action") action?: string,
  ) {
    return this.paymentsService.adminGetAuditLogs({
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
      adminId,
      targetId,
      action,
    });
  }

  @Post("admin/reconcile")
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Admin: Manually trigger reconciliation for stuck pending transactions",
  })
  @ApiOkResponse({
    description: "Reconciliation triggered and summary returned",
  })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiForbiddenResponse({ description: "Forbidden - Admin access required" })
  async adminTriggerReconcile() {
    return this.paymentsService.reconcilePendingTransactions();
  }
}
