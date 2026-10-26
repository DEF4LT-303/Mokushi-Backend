import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import {
  PlanCategory,
  PlanType,
  Transaction,
  TransactionStatus,
} from "@prisma/client";
import { DatabaseService } from "src/database/database.service";
import { PLAN_CONFIGS, PlanConfig } from "./constants/plans.constant";
import { AdminInvalidatePurchaseDto } from "./dto/admin-invalidate-purchase.dto";
import { AdminValidatePurchaseDto } from "./dto/admin-validate-purchase.dto";
import { InitiatePaymentDto } from "./dto/initiate-payment.dto";
import { UpdatePaymentPlanDto } from "./dto/update-payment-plan.dto";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SSLCommerzPayment = require("sslcommerz-lts");

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly sslcommerz: any;
  private readonly storeId: string;
  private readonly isLive: boolean;

  constructor(private readonly databaseService: DatabaseService) {
    this.storeId = process.env.SSLCOMMERZ_STORE_ID || "testbox";
    const storePassword = process.env.SSLCOMMERZ_STORE_PASSWORD || "qwerty";
    this.isLive = process.env.SSLCOMMERZ_IS_LIVE === "true";

    this.sslcommerz = new SSLCommerzPayment(
      this.storeId,
      storePassword,
      this.isLive,
    );
    this.logger.log(
      `SSL Commerz initialized in ${this.isLive ? "LIVE" : "SANDBOX"} mode with Store ID: ${this.storeId}`,
    );
  }

  async getAvailablePlans(category?: PlanCategory) {
    const where: any = { isActive: true };
    if (category) {
      where.category = category;
    }

    const plans = await this.databaseService.paymentPlan.findMany({
      where,
      orderBy: [{ category: "asc" }, { price: "asc" }],
    });

    if (plans.length === 0 && !category) {
      await this.seedDefaultPlans();
      return this.databaseService.paymentPlan.findMany({
        where: { isActive: true },
        orderBy: [{ category: "asc" }, { price: "asc" }],
      });
    }

    return plans;
  }

  async getPlanByType(planType: PlanType) {
    let plan = await this.databaseService.paymentPlan.findUnique({
      where: { planType },
    });

    if (!plan) {
      const count = await this.databaseService.paymentPlan.count();
      if (count === 0) {
        await this.seedDefaultPlans();
        plan = await this.databaseService.paymentPlan.findUnique({
          where: { planType },
        });
      }
    }

    if (!plan) {
      throw new NotFoundException(`Plan '${planType}' not found`);
    }

    return plan;
  }

  private async seedDefaultPlans() {
    try {
      for (const plan of Object.values(PLAN_CONFIGS)) {
        await this.databaseService.paymentPlan.upsert({
          where: { planType: plan.planType },
          update: {
            category: plan.category,
            title: plan.title,
            description: plan.description,
            price: plan.price,
            currency: plan.currency,
            features: plan.features,
            isActive: true,
          },
          create: {
            planType: plan.planType,
            category: plan.category,
            title: plan.title,
            description: plan.description,
            price: plan.price,
            currency: plan.currency,
            features: plan.features,
            isActive: true,
          },
        });
      }
    } catch (error) {
      this.logger.warn(`Could not auto-seed payment plans: ${error.message}`);
    }
  }

  async initiatePayment(userId: string, dto: InitiatePaymentDto) {
    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
      include: { purchases: true },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    let plan = await this.databaseService.paymentPlan.findUnique({
      where: { planType: dto.planType },
    });

    if (!plan) {
      const count = await this.databaseService.paymentPlan.count();
      if (count === 0) {
        await this.seedDefaultPlans();
        plan = await this.databaseService.paymentPlan.findUnique({
          where: { planType: dto.planType },
        });
      }
    }

    if (!plan || !plan.isActive) {
      throw new BadRequestException("Invalid or inactive plan selected");
    }

    const alreadyPurchased = user.purchases.some(
      (p) => p.planType === dto.planType,
    );
    if (alreadyPurchased) {
      throw new BadRequestException(
        `You have already purchased the ${plan.title}.`,
      );
    }

    const hasExistingCoverage =
      (dto.planType === PlanType.N5 &&
        user.purchases.some(
          (p) =>
            p.planType === PlanType.N5_N4_BUNDLE ||
            p.planType === PlanType.N5_RAPID_FIRE_BUNDLE,
        )) ||
      (dto.planType === PlanType.N4 &&
        user.purchases.some(
          (p) =>
            p.planType === PlanType.N5_N4_BUNDLE ||
            p.planType === PlanType.N4_RAPID_FIRE_BUNDLE,
        )) ||
      (dto.planType === PlanType.RAPID_FIRE_N5 &&
        user.purchases.some(
          (p) => p.planType === PlanType.N5_RAPID_FIRE_BUNDLE,
        )) ||
      (dto.planType === PlanType.RAPID_FIRE_N4 &&
        user.purchases.some(
          (p) => p.planType === PlanType.N4_RAPID_FIRE_BUNDLE,
        ));

    if (hasExistingCoverage) {
      throw new BadRequestException(
        "You already have access to this content through an existing bundle.",
      );
    }

    const tranId = `MK_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    // Create pending transaction in database
    await this.databaseService.transaction.create({
      data: {
        userId,
        tranId,
        amount: plan.price,
        currency: plan.currency,
        planToBuy: dto.planType,
        status: TransactionStatus.PENDING,
      },
    });

    const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";

    const paymentData = {
      total_amount: plan.price,
      currency: plan.currency,
      tran_id: tranId,
      success_url: `${backendUrl}/api/payments/success`,
      fail_url: `${backendUrl}/api/payments/fail`,
      cancel_url: `${backendUrl}/api/payments/cancel`,
      ipn_url: `${backendUrl}/api/payments/ipn`,
      shipping_method: "NO",
      product_name: plan.title,
      product_category: "Education",
      product_profile: "non-physical-goods",
      cus_name:
        user.fullName ||
        [user.firstName, user.lastName].filter(Boolean).join(" ") ||
        "Mokushi Learner",
      cus_email: user.email,
      cus_add1: dto.address || dto.cusAddress || "Dhaka, Bangladesh",
      cus_city: dto.city || "Dhaka",
      cus_country: "Bangladesh",
      cus_phone: dto.phoneNumber || dto.cusPhone || "01700000000",
    };

    try {
      const response = await this.sslcommerz.init(paymentData);

      if (response?.GatewayPageURL) {
        return {
          gatewayUrl: response.GatewayPageURL,
          tranId,
          plan,
        };
      }

      this.logger.error("SSL Commerz initialization response error", response);
      throw new InternalServerErrorException(
        response?.failedreason || "Failed to initialize SSL Commerz session",
      );
    } catch (error) {
      this.logger.error(
        `Error during SSL Commerz init for tranId ${tranId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        error.message || "Failed to initiate payment gateway",
      );
    }
  }

  async validateAndFulfillPayment(
    valId: string,
    tranId: string,
    paymentMethod?: string,
  ): Promise<boolean> {
    if (!tranId || !valId) {
      this.logger.warn(
        `Missing valId or tranId. tranId: ${tranId}, valId: ${valId}`,
      );
      return false;
    }

    const transaction = await this.databaseService.transaction.findUnique({
      where: { tranId },
    });

    if (!transaction) {
      this.logger.error(`Transaction not found for tranId: ${tranId}`);
      return false;
    }

    // Idempotency: if already completed, do not re-process
    if (transaction.status === TransactionStatus.SUCCESS) {
      this.logger.log(
        `Transaction ${tranId} is already marked SUCCESS. Skipping fulfillment.`,
      );
      return true;
    }

    try {
      const validationResponse = await this.sslcommerz.validate({
        val_id: valId,
      });

      const gatewayStatus = validationResponse?.status?.toUpperCase();
      const isValid =
        gatewayStatus === "VALID" || gatewayStatus === "VALIDATED";

      if (!isValid) {
        this.logger.error(
          `Payment validation failed for tranId: ${tranId}. Response: ${JSON.stringify(validationResponse)}`,
        );
        await this.databaseService.transaction.updateMany({
          where: { tranId, status: TransactionStatus.PENDING },
          data: { status: TransactionStatus.FAILED, valId },
        });
        return false;
      }

      // Verify transaction ID matches
      if (validationResponse.tran_id && validationResponse.tran_id !== tranId) {
        this.logger.error(
          `Transaction ID mismatch for tranId: ${tranId}. Gateway reported: ${validationResponse.tran_id}`,
        );
        await this.databaseService.transaction.updateMany({
          where: { tranId, status: TransactionStatus.PENDING },
          data: { status: TransactionStatus.FAILED, valId },
        });
        return false;
      }

      // Verify store ID matches to prevent cross-merchant replay
      if (
        validationResponse.store_id &&
        validationResponse.store_id.toLowerCase() !== this.storeId.toLowerCase()
      ) {
        this.logger.error(
          `Store ID mismatch for tranId: ${tranId}. Expected ${this.storeId}, received ${validationResponse.store_id}`,
        );
        await this.databaseService.transaction.updateMany({
          where: { tranId, status: TransactionStatus.PENDING },
          data: { status: TransactionStatus.FAILED, valId },
        });
        return false;
      }

      // Verify currency matches
      const gatewayCurrency = (
        validationResponse.currency_type ||
        validationResponse.currency ||
        ""
      ).toUpperCase();
      if (
        gatewayCurrency &&
        gatewayCurrency !== transaction.currency.toUpperCase()
      ) {
        this.logger.error(
          `Currency mismatch for tranId: ${tranId}. Expected ${transaction.currency}, received ${gatewayCurrency}`,
        );
        await this.databaseService.transaction.updateMany({
          where: { tranId, status: TransactionStatus.PENDING },
          data: { status: TransactionStatus.FAILED, valId },
        });
        return false;
      }

      // Check amount matching
      const validatedAmount = parseFloat(
        validationResponse.amount || validationResponse.currency_amount,
      );
      if (
        isNaN(validatedAmount) ||
        Math.abs(validatedAmount - transaction.amount) > 1
      ) {
        this.logger.error(
          `Amount mismatch for tranId: ${tranId}. Expected ${transaction.amount}, received ${validatedAmount}`,
        );
        await this.databaseService.transaction.updateMany({
          where: { tranId, status: TransactionStatus.PENDING },
          data: { status: TransactionStatus.FAILED, valId },
        });
        return false;
      }

      // Atomically fulfill the purchase and update transaction with concurrency protection
      const fulfillmentResult = await this.databaseService.$transaction(
        async (tx) => {
          const updateResult = await tx.transaction.updateMany({
            where: {
              tranId,
              status: TransactionStatus.PENDING,
            },
            data: {
              status: TransactionStatus.SUCCESS,
              valId,
              paymentMethod:
                paymentMethod ||
                validationResponse.card_type ||
                validationResponse.card_issuer ||
                "SSLCOMMERZ",
            },
          });

          if (updateResult.count === 0) {
            return { alreadyFulfilled: true };
          }

          await tx.userPurchase.upsert({
            where: {
              userId_planType: {
                userId: transaction.userId,
                planType: transaction.planToBuy,
              },
            },
            create: {
              userId: transaction.userId,
              planType: transaction.planToBuy,
            },
            update: {},
          });

          return { alreadyFulfilled: false };
        },
      );

      if (fulfillmentResult.alreadyFulfilled) {
        this.logger.log(
          `Transaction ${tranId} was already fulfilled by concurrent request. Skipping duplicate fulfillment.`,
        );
        return true;
      }

      this.logger.log(
        `Successfully fulfilled purchase for User ${transaction.userId}: Plan ${transaction.planToBuy} (tranId: ${tranId})`,
      );
      return true;
    } catch (err) {
      this.logger.error(
        `Error during payment validation: ${err.message}`,
        err.stack,
      );
      return false;
    }
  }

  async handlePaymentFailure(tranId: string) {
    if (!tranId) return;
    const result = await this.databaseService.transaction.updateMany({
      where: { tranId, status: TransactionStatus.PENDING },
      data: { status: TransactionStatus.FAILED },
    });
    if (result.count > 0) {
      this.logger.log(`Marked transaction ${tranId} as FAILED`);
    }
  }

  async handlePaymentCancel(tranId: string) {
    if (!tranId) return;
    const result = await this.databaseService.transaction.updateMany({
      where: { tranId, status: TransactionStatus.PENDING },
      data: { status: TransactionStatus.CANCELLED },
    });
    if (result.count > 0) {
      this.logger.log(`Marked transaction ${tranId} as CANCELLED`);
    }
  }

  async getUserPurchases(userId: string) {
    return this.databaseService.userPurchase.findMany({
      where: { userId },
      orderBy: { purchasedAt: "desc" },
      include: {
        plan: true,
      },
    });
  }

  async getUserTransactions(userId: string) {
    return this.databaseService.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  getFrontendRedirectUrl(
    status: "success" | "failed" | "cancelled",
    tranId: string,
  ): string {
    const frontendUrl = (
      process.env.FRONTEND_URL || "http://localhost:5173"
    ).replace(/\/+$/, "");

    return `${frontendUrl}/payment-status?status=${status}&tran_id=${tranId || ""}`;
  }

  async adminGetSubscriptions(params: {
    skip?: number;
    take?: number;
    userId?: string;
    planType?: PlanType;
    search?: string;
  }) {
    const { skip, take, userId, planType, search } = params;

    const where: any = {};
    if (userId) {
      where.userId = userId;
    }
    if (planType) {
      where.planType = planType;
    }
    if (search) {
      where.user = {
        OR: [
          { email: { contains: search } },
          { fullName: { contains: search } },
        ],
      };
    }

    const [total, subscriptions] = await Promise.all([
      this.databaseService.userPurchase.count({ where }),
      this.databaseService.userPurchase.findMany({
        where,
        skip,
        take,
        orderBy: { purchasedAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              role: true,
            },
          },
        },
      }),
    ]);

    return {
      total,
      count: subscriptions.length,
      subscriptions,
    };
  }

  async adminGetUserSubscriptions(userId: string) {
    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const [purchases, transactions] = await Promise.all([
      this.databaseService.userPurchase.findMany({
        where: { userId },
        orderBy: { purchasedAt: "desc" },
      }),
      this.databaseService.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const hasN5 = purchases.some(
      (p) =>
        p.planType === PlanType.N5 ||
        p.planType === PlanType.N5_N4_BUNDLE ||
        p.planType === PlanType.N5_RAPID_FIRE_BUNDLE,
    );
    const hasN4 = purchases.some(
      (p) =>
        p.planType === PlanType.N4 ||
        p.planType === PlanType.N5_N4_BUNDLE ||
        p.planType === PlanType.N4_RAPID_FIRE_BUNDLE,
    );
    const hasRapidFireN5 = purchases.some(
      (p) =>
        p.planType === PlanType.RAPID_FIRE_N5 ||
        p.planType === PlanType.N5_RAPID_FIRE_BUNDLE,
    );
    const hasRapidFireN4 = purchases.some(
      (p) =>
        p.planType === PlanType.RAPID_FIRE_N4 ||
        p.planType === PlanType.N4_RAPID_FIRE_BUNDLE,
    );

    return {
      user,
      accessSummary: {
        hasN5,
        hasN4,
        hasRapidFireN5,
        hasRapidFireN4,
      },
      purchases,
      transactions,
    };
  }

  async adminValidatePurchase(dto: AdminValidatePurchaseDto, adminId?: string) {
    const user = await this.databaseService.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const plan = await this.databaseService.paymentPlan.findUnique({
      where: { planType: dto.planType },
    });
    const auditNote = dto.reason
      ? `ADMIN_MANUAL: ${dto.reason}`
      : "ADMIN_MANUAL";

    let targetTransaction: Transaction | null = null;
    if (dto.tranId) {
      targetTransaction = await this.databaseService.transaction.findUnique({
        where: { tranId: dto.tranId },
      });
      if (!targetTransaction) {
        throw new NotFoundException(
          `Transaction with tranId '${dto.tranId}' not found`,
        );
      }
      if (targetTransaction.userId !== dto.userId) {
        throw new BadRequestException(
          `Transaction '${dto.tranId}' does not belong to user '${dto.userId}'`,
        );
      }
    }

    const [transaction, purchase] = await this.databaseService.$transaction(
      async (tx) => {
        let updatedOrCreatedTx;
        if (targetTransaction) {
          const valIdToSet = targetTransaction.valId || "ADMIN_VALIDATED";
          updatedOrCreatedTx = await tx.transaction.update({
            where: { tranId: dto.tranId },
            data: {
              status: TransactionStatus.SUCCESS,
              valId: valIdToSet,
              paymentMethod: auditNote,
            },
          });
        } else {
          const adminTranId = `ADMIN_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
          updatedOrCreatedTx = await tx.transaction.create({
            data: {
              userId: dto.userId,
              tranId: adminTranId,
              valId: "ADMIN_VALIDATED",
              amount: plan?.price || 0,
              currency: plan?.currency || "BDT",
              planToBuy: dto.planType,
              status: TransactionStatus.SUCCESS,
              paymentMethod: auditNote,
            },
          });
        }

        const upsertedPurchase = await tx.userPurchase.upsert({
          where: {
            userId_planType: {
              userId: dto.userId,
              planType: dto.planType,
            },
          },
          create: {
            userId: dto.userId,
            planType: dto.planType,
          },
          update: {},
        });

        await tx.auditLog.create({
          data: {
            adminId: adminId || "SYSTEM_ADMIN",
            action: "PURCHASE_MANUALLY_VALIDATED",
            targetId: dto.userId,
            details: {
              planType: dto.planType,
              tranId: updatedOrCreatedTx.tranId,
              amount: plan?.price || 0,
              reason: dto.reason || "Manual validation by admin",
            },
          },
        });

        return [updatedOrCreatedTx, upsertedPurchase];
      },
    );

    this.logger.log(
      `Admin validated purchase of plan ${dto.planType} for user ${dto.userId} (tranId: ${transaction.tranId})`,
    );

    return {
      message: "Purchase successfully validated",
      purchase,
      transaction,
    };
  }

  async adminGetAllPlans() {
    return this.databaseService.paymentPlan.findMany({
      orderBy: [{ category: "asc" }, { price: "asc" }],
    });
  }

  async adminUpdatePlan(planType: PlanType, dto: UpdatePaymentPlanDto) {
    const plan = await this.databaseService.paymentPlan.findUnique({
      where: { planType },
    });
    if (!plan) {
      throw new NotFoundException(`Plan '${planType}' not found`);
    }

    return this.databaseService.paymentPlan.update({
      where: { planType },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.features !== undefined && { features: dto.features }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async adminInvalidatePurchase(
    dto: AdminInvalidatePurchaseDto,
    adminId?: string,
  ) {
    const user = await this.databaseService.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const existingPurchase = await this.databaseService.userPurchase.findUnique(
      {
        where: {
          userId_planType: {
            userId: dto.userId,
            planType: dto.planType,
          },
        },
      },
    );

    if (!existingPurchase) {
      throw new NotFoundException(
        `User does not have an active purchase for ${dto.planType}`,
      );
    }

    const auditNote = dto.reason
      ? `REVOKED_BY_ADMIN: ${dto.reason}`
      : "REVOKED_BY_ADMIN";

    await this.databaseService.$transaction(async (tx) => {
      await tx.userPurchase.delete({
        where: {
          userId_planType: {
            userId: dto.userId,
            planType: dto.planType,
          },
        },
      });

      const latestTx = await tx.transaction.findFirst({
        where: {
          userId: dto.userId,
          planToBuy: dto.planType,
          status: TransactionStatus.SUCCESS,
        },
        orderBy: { createdAt: "desc" },
      });

      if (latestTx) {
        await tx.transaction.update({
          where: { id: latestTx.id },
          data: {
            status: TransactionStatus.CANCELLED,
            paymentMethod: auditNote,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          adminId: adminId || "SYSTEM_ADMIN",
          action: "PURCHASE_REVOKED",
          targetId: dto.userId,
          details: {
            planType: dto.planType,
            transactionId: latestTx?.id || null,
            tranId: latestTx?.tranId || null,
            reason: dto.reason || "Manual revocation by admin",
          },
        },
      });
    });

    this.logger.log(
      `Admin invalidated purchase of plan ${dto.planType} for user ${dto.userId}. Reason: ${dto.reason || "None specified"}`,
    );

    return {
      message: "Purchase successfully invalidated",
      userId: dto.userId,
      planType: dto.planType,
      reason: dto.reason,
    };
  }

  async adminGetAllTransactions(params: {
    skip?: number;
    take?: number;
    userId?: string;
    status?: TransactionStatus;
  }) {
    const { skip, take, userId, status } = params;

    const where: any = {};
    if (userId) {
      where.userId = userId;
    }
    if (status) {
      where.status = status;
    }

    const [total, transactions] = await Promise.all([
      this.databaseService.transaction.count({ where }),
      this.databaseService.transaction.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              role: true,
            },
          },
        },
      }),
    ]);

    return {
      total,
      count: transactions.length,
      transactions,
    };
  }

  async adminGetAuditLogs(params: {
    skip?: number;
    take?: number;
    adminId?: string;
    targetId?: string;
    action?: string;
  }) {
    const { skip, take, adminId, targetId, action } = params;

    const where: any = {};
    if (adminId) {
      where.adminId = adminId;
    }
    if (targetId) {
      where.targetId = targetId;
    }
    if (action) {
      where.action = action;
    }

    const [total, logs] = await Promise.all([
      this.databaseService.auditLog.count({ where }),
      this.databaseService.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      total,
      count: logs.length,
      logs,
    };
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleReconciliationCron() {
    this.logger.log("Running scheduled payment reconciliation job...");
    try {
      const summary = await this.reconcilePendingTransactions();
      this.logger.log(
        `Reconciliation completed: Checked=${summary.checked}, Fulfilled=${summary.fulfilled}, Failed/Cancelled=${summary.failed}, Expired=${summary.expired}`,
      );
    } catch (err) {
      this.logger.error(
        `Error during reconciliation cron: ${err.message}`,
        err.stack,
      );
    }
  }

  async reconcilePendingTransactions(batchSize: number = 50): Promise<{
    checked: number;
    fulfilled: number;
    expired: number;
    failed: number;
  }> {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const pendingTransactions = await this.databaseService.transaction.findMany(
      {
        where: {
          status: TransactionStatus.PENDING,
          createdAt: {
            lte: fifteenMinutesAgo,
            gte: twentyFourHoursAgo,
          },
        },
        take: batchSize,
        orderBy: { createdAt: "asc" },
      },
    );

    let fulfilled = 0;
    let expired = 0;
    let failed = 0;

    for (const tx of pendingTransactions) {
      try {
        const queryResult =
          await this.sslcommerz.transactionQueryByTransactionId({
            tran_id: tx.tranId,
          });

        const item = queryResult?.element?.[0];

        const itemStatus = item?.status?.toUpperCase();

        if (itemStatus === "VALID" || itemStatus === "VALIDATED") {
          this.logger.log(
            `Reconciler: Fulfilling orphaned transaction ${tx.tranId}`,
          );
          const success = await this.validateAndFulfillPayment(
            item.val_id,
            tx.tranId,
            item.card_type,
          );
          if (success) fulfilled++;
        } else if (itemStatus === "FAILED") {
          await this.handlePaymentFailure(tx.tranId);
          failed++;
        } else if (itemStatus === "CANCELLED") {
          await this.handlePaymentCancel(tx.tranId);
          failed++;
        } else if (tx.createdAt < twoHoursAgo) {
          // If older than 2 hours and still unattempted/no record, mark FAILED (abandoned checkout)
          this.logger.log(
            `Reconciler: Expiring abandoned transaction ${tx.tranId}`,
          );
          const res = await this.databaseService.transaction.updateMany({
            where: { tranId: tx.tranId, status: TransactionStatus.PENDING },
            data: { status: TransactionStatus.FAILED },
          });
          if (res.count > 0) expired++;
        }
      } catch (err) {
        this.logger.warn(
          `Reconciler: Failed to query gateway for tranId ${tx.tranId}: ${err.message}`,
        );
      }
    }

    return {
      checked: pendingTransactions.length,
      fulfilled,
      expired,
      failed,
    };
  }
}
