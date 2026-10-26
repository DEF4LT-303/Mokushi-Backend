import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { PlanCategory, PlanType, TransactionStatus } from "@prisma/client";
import { DatabaseService } from "src/database/database.service";
import { PLAN_CONFIGS } from "./constants/plans.constant";
import { PaymentsService } from "./payments.service";

describe("PaymentsService", () => {
  let service: PaymentsService;
  let mockDatabaseService: any;

  beforeEach(async () => {
    mockDatabaseService = {
      user: {
        findUnique: jest.fn(),
      },
      paymentPlan: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
        count: jest.fn(),
      },
      transaction: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      userPurchase: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn((arg) => {
        if (typeof arg === "function") {
          return arg(mockDatabaseService);
        }
        return Promise.all(arg);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getAvailablePlans", () => {
    it("should return all configured plans from database", async () => {
      const mockPlans = Object.values(PLAN_CONFIGS);
      mockDatabaseService.paymentPlan.findMany.mockResolvedValue(mockPlans);

      const plans = await service.getAvailablePlans();
      expect(plans.length).toBe(mockPlans.length);
      expect(plans.map((p) => p.planType)).toContain(PlanType.N5);
      expect(mockDatabaseService.paymentPlan.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: [{ category: "asc" }, { price: "asc" }],
      });
    });

    it("should filter plans by category when provided", async () => {
      const corePlans = Object.values(PLAN_CONFIGS).filter(
        (p) => p.category === PlanCategory.CORE_MODULE,
      );
      mockDatabaseService.paymentPlan.findMany.mockResolvedValue(corePlans);

      const plans = await service.getAvailablePlans(PlanCategory.CORE_MODULE);
      expect(plans.length).toBe(corePlans.length);
      expect(mockDatabaseService.paymentPlan.findMany).toHaveBeenCalledWith({
        where: { isActive: true, category: PlanCategory.CORE_MODULE },
        orderBy: [{ category: "asc" }, { price: "asc" }],
      });
    });
  });

  describe("getPlanByType", () => {
    it("should return plan if found", async () => {
      mockDatabaseService.paymentPlan.findUnique.mockResolvedValue(
        PLAN_CONFIGS[PlanType.N5],
      );

      const plan = await service.getPlanByType(PlanType.N5);
      expect(plan.planType).toBe(PlanType.N5);
      expect(plan.category).toBe(PlanCategory.CORE_MODULE);
    });

    it("should throw NotFoundException if plan not found and count > 0", async () => {
      mockDatabaseService.paymentPlan.findUnique.mockResolvedValue(null);
      mockDatabaseService.paymentPlan.count.mockResolvedValue(7);

      await expect(service.getPlanByType(PlanType.N5)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("initiatePayment", () => {
    it("should throw NotFoundException if user is not found", async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.initiatePayment("non-existent-user", {
          planType: PlanType.N5,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException if plan is not found or inactive", async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue({
        id: "user-1",
        purchases: [],
      });
      mockDatabaseService.paymentPlan.findUnique.mockResolvedValue(null);
      mockDatabaseService.paymentPlan.count.mockResolvedValue(7);

      await expect(
        service.initiatePayment("user-1", {
          planType: PlanType.N5,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException if user already has superset bundle", async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue({
        id: "user-1",
        purchases: [{ planType: PlanType.N5_N4_BUNDLE }],
      });
      mockDatabaseService.paymentPlan.findUnique.mockResolvedValue(
        PLAN_CONFIGS[PlanType.N5],
      );

      await expect(
        service.initiatePayment("user-1", {
          planType: PlanType.N5,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException if user already owns the selected plan", async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue({
        id: "user-1",
        purchases: [{ planType: PlanType.N5 }],
      });
      mockDatabaseService.paymentPlan.findUnique.mockResolvedValue(
        PLAN_CONFIGS[PlanType.N5],
      );

      await expect(
        service.initiatePayment("user-1", {
          planType: PlanType.N5,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should initiate transaction and return gateway url", async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "learner@mokushi.local",
        fullName: "Test Learner",
        purchases: [],
      });
      mockDatabaseService.paymentPlan.findUnique.mockResolvedValue(
        PLAN_CONFIGS[PlanType.N5],
      );
      mockDatabaseService.transaction.create.mockResolvedValue({});

      // Mock sslcommerz.init
      (service as any).sslcommerz = {
        init: jest.fn().mockResolvedValue({
          status: "SUCCESS",
          GatewayPageURL: "https://sandbox.sslcommerz.com/gwprocess/v4/test",
        }),
      };

      const result = await service.initiatePayment("user-1", {
        planType: PlanType.N5,
      });

      expect(result.gatewayUrl).toBe(
        "https://sandbox.sslcommerz.com/gwprocess/v4/test",
      );
      expect(result.tranId).toBeDefined();
      expect(mockDatabaseService.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user-1",
            planToBuy: PlanType.N5,
            status: TransactionStatus.PENDING,
          }),
        }),
      );
    });
  });

  describe("validateAndFulfillPayment", () => {
    it("should return false if tranId or valId is missing", async () => {
      const result = await service.validateAndFulfillPayment("", "");
      expect(result).toBe(false);
    });

    it("should return true immediately if transaction is already SUCCESS (idempotent)", async () => {
      mockDatabaseService.transaction.findUnique.mockResolvedValue({
        tranId: "MK_123",
        status: TransactionStatus.SUCCESS,
      });

      const result = await service.validateAndFulfillPayment(
        "VAL_123",
        "MK_123",
      );
      expect(result).toBe(true);
      expect(mockDatabaseService.transaction.update).not.toHaveBeenCalled();
    });

    it("should fulfill transaction and grant UserPurchase on valid validation response", async () => {
      mockDatabaseService.transaction.findUnique.mockResolvedValue({
        userId: "user-1",
        tranId: "MK_123",
        status: TransactionStatus.PENDING,
        amount: 499,
        planToBuy: PlanType.N5,
      });
      mockDatabaseService.transaction.updateMany.mockResolvedValue({
        count: 1,
      });

      (service as any).sslcommerz = {
        validate: jest.fn().mockResolvedValue({
          status: "VALID",
          amount: "499.00",
          card_type: "BKASH-BKash",
        }),
      };

      const result = await service.validateAndFulfillPayment(
        "VAL_123",
        "MK_123",
        "BKASH",
      );

      expect(result).toBe(true);
      expect(mockDatabaseService.$transaction).toHaveBeenCalled();
      expect(mockDatabaseService.transaction.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tranId: "MK_123", status: TransactionStatus.PENDING },
          data: expect.objectContaining({
            status: TransactionStatus.SUCCESS,
            valId: "VAL_123",
          }),
        }),
      );
      expect(mockDatabaseService.userPurchase.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_planType: {
              userId: "user-1",
              planType: PlanType.N5,
            },
          },
        }),
      );
    });

    it("should gracefully handle concurrent fulfillment without duplicate purchase provisioning", async () => {
      mockDatabaseService.transaction.findUnique.mockResolvedValue({
        userId: "user-1",
        tranId: "MK_123",
        status: TransactionStatus.PENDING,
        amount: 499,
        planToBuy: PlanType.N5,
      });
      // Simulate another process winning the atomic transition
      mockDatabaseService.transaction.updateMany.mockResolvedValue({
        count: 0,
      });

      (service as any).sslcommerz = {
        validate: jest.fn().mockResolvedValue({
          status: "VALID",
          amount: "499.00",
          card_type: "BKASH-BKash",
        }),
      };

      const result = await service.validateAndFulfillPayment(
        "VAL_123",
        "MK_123",
        "BKASH",
      );

      expect(result).toBe(true);
      expect(mockDatabaseService.transaction.updateMany).toHaveBeenCalled();
      expect(mockDatabaseService.userPurchase.upsert).not.toHaveBeenCalled();
    });

    it("should mark transaction FAILED when gateway validation returns invalid", async () => {
      mockDatabaseService.transaction.findUnique.mockResolvedValue({
        userId: "user-1",
        tranId: "MK_123",
        status: TransactionStatus.PENDING,
        amount: 499,
        planToBuy: PlanType.N5,
      });
      mockDatabaseService.transaction.updateMany.mockResolvedValue({
        count: 1,
      });

      (service as any).sslcommerz = {
        validate: jest.fn().mockResolvedValue({
          status: "INVALID_TRANSACTION",
        }),
      };

      const result = await service.validateAndFulfillPayment(
        "VAL_123",
        "MK_123",
      );

      expect(result).toBe(false);
      expect(mockDatabaseService.transaction.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tranId: "MK_123", status: TransactionStatus.PENDING },
          data: expect.objectContaining({ status: TransactionStatus.FAILED }),
        }),
      );
    });
    it("should mark transaction FAILED when gateway returns mismatched tran_id", async () => {
      mockDatabaseService.transaction.findUnique.mockResolvedValue({
        userId: "user-1",
        tranId: "MK_123",
        status: TransactionStatus.PENDING,
        amount: 499,
        currency: "BDT",
        planToBuy: PlanType.N5,
      });
      mockDatabaseService.transaction.updateMany.mockResolvedValue({
        count: 1,
      });

      (service as any).sslcommerz = {
        validate: jest.fn().mockResolvedValue({
          status: "VALID",
          tran_id: "OTHER_TRANSACTION",
          amount: "499.00",
          currency_type: "BDT",
        }),
      };

      const result = await service.validateAndFulfillPayment(
        "VAL_123",
        "MK_123",
      );

      expect(result).toBe(false);
      expect(mockDatabaseService.transaction.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tranId: "MK_123", status: TransactionStatus.PENDING },
          data: expect.objectContaining({ status: TransactionStatus.FAILED }),
        }),
      );
    });

    it("should mark transaction FAILED when gateway returns mismatched store_id", async () => {
      mockDatabaseService.transaction.findUnique.mockResolvedValue({
        userId: "user-1",
        tranId: "MK_123",
        status: TransactionStatus.PENDING,
        amount: 499,
        currency: "BDT",
        planToBuy: PlanType.N5,
      });
      mockDatabaseService.transaction.updateMany.mockResolvedValue({
        count: 1,
      });

      (service as any).sslcommerz = {
        validate: jest.fn().mockResolvedValue({
          status: "VALID",
          tran_id: "MK_123",
          store_id: "malicious_fake_store",
          amount: "499.00",
          currency_type: "BDT",
        }),
      };

      const result = await service.validateAndFulfillPayment(
        "VAL_123",
        "MK_123",
      );

      expect(result).toBe(false);
      expect(mockDatabaseService.transaction.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tranId: "MK_123", status: TransactionStatus.PENDING },
          data: expect.objectContaining({ status: TransactionStatus.FAILED }),
        }),
      );
    });

    it("should mark transaction FAILED when gateway returns mismatched currency", async () => {
      mockDatabaseService.transaction.findUnique.mockResolvedValue({
        userId: "user-1",
        tranId: "MK_123",
        status: TransactionStatus.PENDING,
        amount: 499,
        currency: "BDT",
        planToBuy: PlanType.N5,
      });
      mockDatabaseService.transaction.updateMany.mockResolvedValue({
        count: 1,
      });

      (service as any).sslcommerz = {
        validate: jest.fn().mockResolvedValue({
          status: "VALID",
          tran_id: "MK_123",
          amount: "499.00",
          currency_type: "USD",
        }),
      };

      const result = await service.validateAndFulfillPayment(
        "VAL_123",
        "MK_123",
      );

      expect(result).toBe(false);
      expect(mockDatabaseService.transaction.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tranId: "MK_123", status: TransactionStatus.PENDING },
          data: expect.objectContaining({ status: TransactionStatus.FAILED }),
        }),
      );
    });

    it("should mark transaction FAILED when gateway returns mismatched amount", async () => {
      mockDatabaseService.transaction.findUnique.mockResolvedValue({
        userId: "user-1",
        tranId: "MK_123",
        status: TransactionStatus.PENDING,
        amount: 499,
        currency: "BDT",
        planToBuy: PlanType.N5,
      });
      mockDatabaseService.transaction.updateMany.mockResolvedValue({
        count: 1,
      });

      (service as any).sslcommerz = {
        validate: jest.fn().mockResolvedValue({
          status: "VALID",
          tran_id: "MK_123",
          amount: "10.00",
          currency_type: "BDT",
        }),
      };

      const result = await service.validateAndFulfillPayment(
        "VAL_123",
        "MK_123",
      );

      expect(result).toBe(false);
      expect(mockDatabaseService.transaction.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tranId: "MK_123", status: TransactionStatus.PENDING },
          data: expect.objectContaining({ status: TransactionStatus.FAILED }),
        }),
      );
    });
  });

  describe("handlePaymentFailure and handlePaymentCancel", () => {
    it("should set transaction status to FAILED on handlePaymentFailure", async () => {
      mockDatabaseService.transaction.updateMany.mockResolvedValue({
        count: 1,
      });

      await service.handlePaymentFailure("MK_123");

      expect(mockDatabaseService.transaction.updateMany).toHaveBeenCalledWith({
        where: { tranId: "MK_123", status: TransactionStatus.PENDING },
        data: { status: TransactionStatus.FAILED },
      });
    });

    it("should set transaction status to CANCELLED on handlePaymentCancel", async () => {
      mockDatabaseService.transaction.updateMany.mockResolvedValue({
        count: 1,
      });

      await service.handlePaymentCancel("MK_123");

      expect(mockDatabaseService.transaction.updateMany).toHaveBeenCalledWith({
        where: { tranId: "MK_123", status: TransactionStatus.PENDING },
        data: { status: TransactionStatus.CANCELLED },
      });
    });
  });

  describe("adminGetSubscriptions", () => {
    it("should return subscriptions list and total count", async () => {
      const mockSubscriptions = [
        {
          id: "sub-1",
          userId: "user-1",
          planType: PlanType.N5,
          purchasedAt: new Date(),
          user: {
            id: "user-1",
            email: "test@mokushi.com",
            fullName: "Test User",
          },
        },
      ];
      mockDatabaseService.userPurchase.count.mockResolvedValue(1);
      mockDatabaseService.userPurchase.findMany.mockResolvedValue(
        mockSubscriptions,
      );

      const result = await service.adminGetSubscriptions({
        skip: 0,
        take: 10,
        search: "test",
      });

      expect(result.total).toBe(1);
      expect(result.count).toBe(1);
      expect(result.subscriptions).toEqual(mockSubscriptions);
      expect(mockDatabaseService.userPurchase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
          where: expect.objectContaining({
            user: {
              OR: [
                { email: { contains: "test" } },
                { fullName: { contains: "test" } },
              ],
            },
          }),
        }),
      );
    });
  });

  describe("adminGetUserSubscriptions", () => {
    it("should throw NotFoundException if user is not found", async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.adminGetUserSubscriptions("unknown-user"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should return user details, access summary, active purchases, and transactions", async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "learner@test.com",
        fullName: "Learner One",
        role: "USER",
      });
      mockDatabaseService.userPurchase.findMany.mockResolvedValue([
        { planType: PlanType.N5, purchasedAt: new Date() },
      ]);
      mockDatabaseService.transaction.findMany.mockResolvedValue([
        { tranId: "MK_1", status: TransactionStatus.SUCCESS, amount: 499 },
      ]);

      const result = await service.adminGetUserSubscriptions("user-1");

      expect(result.user.id).toBe("user-1");
      expect(result.accessSummary.hasN5).toBe(true);
      expect(result.accessSummary.hasN4).toBe(false);
      expect(result.accessSummary.hasRapidFireN5).toBe(false);
      expect(result.accessSummary.hasRapidFireN4).toBe(false);
      expect(result.purchases.length).toBe(1);
      expect(result.transactions.length).toBe(1);
    });
  });

  describe("adminValidatePurchase", () => {
    it("should throw NotFoundException if target user does not exist", async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.adminValidatePurchase({
          userId: "non-existent",
          planType: PlanType.N5,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException if tranId is specified but transaction does not exist", async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue({ id: "user-1" });
      mockDatabaseService.transaction.findUnique.mockResolvedValue(null);

      await expect(
        service.adminValidatePurchase({
          userId: "user-1",
          planType: PlanType.N5,
          tranId: "NON_EXISTENT_TX",
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should reject validation when tranId belongs to a different user", async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue({ id: "user-1" });
      mockDatabaseService.transaction.findUnique.mockResolvedValue({
        tranId: "MK_OTHER",
        userId: "other-user",
        status: TransactionStatus.PENDING,
      });

      await expect(
        service.adminValidatePurchase({
          userId: "user-1",
          planType: PlanType.N5,
          tranId: "MK_OTHER",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should manually validate and fulfill purchase with existing tranId", async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue({ id: "user-1" });
      mockDatabaseService.paymentPlan.findUnique.mockResolvedValue(
        PLAN_CONFIGS[PlanType.N5],
      );
      mockDatabaseService.transaction.findUnique.mockResolvedValue({
        tranId: "MK_PENDING",
        userId: "user-1",
        status: TransactionStatus.PENDING,
      });
      mockDatabaseService.transaction.update.mockResolvedValue({
        tranId: "MK_PENDING",
        status: TransactionStatus.SUCCESS,
      });
      mockDatabaseService.userPurchase.upsert.mockResolvedValue({
        userId: "user-1",
        planType: PlanType.N5,
      });

      const result = await service.adminValidatePurchase(
        {
          userId: "user-1",
          planType: PlanType.N5,
          tranId: "MK_PENDING",
          reason: "Offline bank transfer",
        },
        "admin-123",
      );

      expect(result.message).toBe("Purchase successfully validated");
      expect(mockDatabaseService.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tranId: "MK_PENDING" },
          data: expect.objectContaining({
            status: TransactionStatus.SUCCESS,
            paymentMethod: "ADMIN_MANUAL: Offline bank transfer",
          }),
        }),
      );
      expect(mockDatabaseService.userPurchase.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_planType: {
              userId: "user-1",
              planType: PlanType.N5,
            },
          },
        }),
      );
      expect(mockDatabaseService.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            adminId: "admin-123",
            action: "PURCHASE_MANUALLY_VALIDATED",
            targetId: "user-1",
          }),
        }),
      );
    });

    it("should create audit transaction and grant plan if tranId is not provided", async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue({ id: "user-1" });
      mockDatabaseService.paymentPlan.findUnique.mockResolvedValue(
        PLAN_CONFIGS[PlanType.N5_N4_BUNDLE],
      );
      mockDatabaseService.transaction.create.mockResolvedValue({
        tranId: "ADMIN_GRANT_123",
        status: TransactionStatus.SUCCESS,
      });
      mockDatabaseService.userPurchase.upsert.mockResolvedValue({
        userId: "user-1",
        planType: PlanType.N5_N4_BUNDLE,
      });

      const result = await service.adminValidatePurchase(
        {
          userId: "user-1",
          planType: PlanType.N5_N4_BUNDLE,
        },
        "admin-123",
      );

      expect(result.message).toBe("Purchase successfully validated");
      expect(mockDatabaseService.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user-1",
            planToBuy: PlanType.N5_N4_BUNDLE,
            status: TransactionStatus.SUCCESS,
          }),
        }),
      );
      expect(mockDatabaseService.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            adminId: "admin-123",
            action: "PURCHASE_MANUALLY_VALIDATED",
            targetId: "user-1",
          }),
        }),
      );
    });
  });

  describe("adminInvalidatePurchase", () => {
    it("should throw NotFoundException if user does not exist", async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.adminInvalidatePurchase({
          userId: "non-existent",
          planType: PlanType.N5,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException if user does not have this purchase active", async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue({ id: "user-1" });
      mockDatabaseService.userPurchase.findUnique.mockResolvedValue(null);

      await expect(
        service.adminInvalidatePurchase({
          userId: "user-1",
          planType: PlanType.N5,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should delete UserPurchase and cancel associated transaction", async () => {
      mockDatabaseService.user.findUnique.mockResolvedValue({ id: "user-1" });
      mockDatabaseService.userPurchase.findUnique.mockResolvedValue({
        userId: "user-1",
        planType: PlanType.N5,
      });
      mockDatabaseService.userPurchase.delete.mockResolvedValue({});
      mockDatabaseService.transaction.findFirst.mockResolvedValue({
        id: "tx-1",
        status: TransactionStatus.SUCCESS,
      });
      mockDatabaseService.transaction.update.mockResolvedValue({});

      const result = await service.adminInvalidatePurchase(
        {
          userId: "user-1",
          planType: PlanType.N5,
          reason: "Refund processed",
        },
        "admin-123",
      );

      expect(result.message).toBe("Purchase successfully invalidated");
      expect(mockDatabaseService.userPurchase.delete).toHaveBeenCalledWith({
        where: {
          userId_planType: {
            userId: "user-1",
            planType: PlanType.N5,
          },
        },
      });
      expect(mockDatabaseService.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "tx-1" },
          data: expect.objectContaining({
            status: TransactionStatus.CANCELLED,
            paymentMethod: "REVOKED_BY_ADMIN: Refund processed",
          }),
        }),
      );
      expect(mockDatabaseService.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            adminId: "admin-123",
            action: "PURCHASE_REVOKED",
            targetId: "user-1",
          }),
        }),
      );
    });
  });

  describe("adminGetAuditLogs", () => {
    it("should return audit logs list and total count", async () => {
      const mockLogs = [
        {
          id: "log-1",
          adminId: "admin-123",
          action: "PURCHASE_MANUALLY_VALIDATED",
          targetId: "user-1",
        },
      ];
      mockDatabaseService.auditLog.count.mockResolvedValue(1);
      mockDatabaseService.auditLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.adminGetAuditLogs({
        skip: 0,
        take: 10,
        adminId: "admin-123",
        action: "PURCHASE_MANUALLY_VALIDATED",
      });

      expect(result.total).toBe(1);
      expect(result.count).toBe(1);
      expect(result.logs).toEqual(mockLogs);
      expect(mockDatabaseService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
          where: expect.objectContaining({
            adminId: "admin-123",
            action: "PURCHASE_MANUALLY_VALIDATED",
          }),
        }),
      );
    });
  });

  describe("adminGetAllTransactions", () => {
    it("should return transactions list and total count", async () => {
      mockDatabaseService.transaction.count.mockResolvedValue(1);
      mockDatabaseService.transaction.findMany.mockResolvedValue([
        { id: "tx-1", tranId: "MK_1" },
      ]);

      const result = await service.adminGetAllTransactions({
        status: TransactionStatus.SUCCESS,
      });

      expect(result.total).toBe(1);
      expect(result.transactions.length).toBe(1);
      expect(mockDatabaseService.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: TransactionStatus.SUCCESS },
        }),
      );
    });
  });

  describe("reconcilePendingTransactions", () => {
    it("should fulfill stuck pending transactions reported as VALID by gateway", async () => {
      const mockPendingTx = {
        id: "tx-pending",
        tranId: "MK_PENDING",
        status: TransactionStatus.PENDING,
        amount: 499,
        currency: "BDT",
        planToBuy: PlanType.N5,
        userId: "user-1",
        createdAt: new Date(Date.now() - 30 * 60 * 1000),
      };

      mockDatabaseService.transaction.findMany.mockResolvedValue([
        mockPendingTx,
      ]);
      mockDatabaseService.transaction.findUnique.mockResolvedValue(
        mockPendingTx,
      );
      mockDatabaseService.transaction.updateMany.mockResolvedValue({
        count: 1,
      });
      mockDatabaseService.userPurchase.upsert.mockResolvedValue({});

      (service as any).sslcommerz = {
        transactionQueryByTransactionId: jest.fn().mockResolvedValue({
          element: [
            {
              status: "VALID",
              val_id: "VAL_RECONCILED",
              tran_id: "MK_PENDING",
              amount: "499.00",
              currency_type: "BDT",
              card_type: "BKASH",
            },
          ],
        }),
        validate: jest.fn().mockResolvedValue({
          status: "VALID",
          tran_id: "MK_PENDING",
          amount: "499.00",
          currency_type: "BDT",
          card_type: "BKASH",
        }),
      };

      const result = await service.reconcilePendingTransactions();

      expect(result.checked).toBe(1);
      expect(result.fulfilled).toBe(1);
    });

    it("should expire abandoned transactions older than 2 hours that are unattempted", async () => {
      const mockAbandonedTx = {
        id: "tx-abandoned",
        tranId: "MK_ABANDONED",
        status: TransactionStatus.PENDING,
        amount: 499,
        currency: "BDT",
        planToBuy: PlanType.N5,
        userId: "user-1",
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      };

      mockDatabaseService.transaction.findMany.mockResolvedValue([
        mockAbandonedTx,
      ]);
      mockDatabaseService.transaction.updateMany.mockResolvedValue({
        count: 1,
      });

      (service as any).sslcommerz = {
        transactionQueryByTransactionId: jest.fn().mockResolvedValue({
          element: [{ status: "UNATTEMPTED" }],
        }),
      };

      const result = await service.reconcilePendingTransactions();

      expect(result.checked).toBe(1);
      expect(result.expired).toBe(1);
      expect(mockDatabaseService.transaction.updateMany).toHaveBeenCalledWith({
        where: { tranId: "MK_ABANDONED", status: TransactionStatus.PENDING },
        data: { status: TransactionStatus.FAILED },
      });
    });
  });

  describe("getFrontendRedirectUrl", () => {
    const originalFrontendUrl = process.env.FRONTEND_URL;

    afterEach(() => {
      process.env.FRONTEND_URL = originalFrontendUrl;
    });

    it("should redirect to /payment-status with status and tran_id for success status", () => {
      process.env.FRONTEND_URL = "https://mokushiken.com";
      const url = service.getFrontendRedirectUrl("success", "MK_SUCCESS_1");
      expect(url).toBe(
        "https://mokushiken.com/payment-status?status=success&tran_id=MK_SUCCESS_1",
      );
    });

    it("should redirect to /payment-status with status and tran_id for failed status", () => {
      process.env.FRONTEND_URL = "https://mokushiken.com";
      const url = service.getFrontendRedirectUrl("failed", "MK_FAILED_1");
      expect(url).toBe(
        "https://mokushiken.com/payment-status?status=failed&tran_id=MK_FAILED_1",
      );
    });

    it("should redirect to /payment-status with status and tran_id for cancelled status", () => {
      process.env.FRONTEND_URL = "https://mokushiken.com";
      const url = service.getFrontendRedirectUrl("cancelled", "MK_CANCEL_1");
      expect(url).toBe(
        "https://mokushiken.com/payment-status?status=cancelled&tran_id=MK_CANCEL_1",
      );
    });

    it("should normalize trailing slashes on FRONTEND_URL", () => {
      process.env.FRONTEND_URL = "https://mokushiken.com/";
      const url = service.getFrontendRedirectUrl("success", "MK_SUCCESS_2");
      expect(url).toBe(
        "https://mokushiken.com/payment-status?status=success&tran_id=MK_SUCCESS_2",
      );
    });

    it("should fallback to localhost if FRONTEND_URL is not set", () => {
      delete process.env.FRONTEND_URL;
      const url = service.getFrontendRedirectUrl("success", "MK_LOCAL");
      expect(url).toBe(
        "http://localhost:5173/payment-status?status=success&tran_id=MK_LOCAL",
      );
    });
  });

  describe("getUserPurchases", () => {
    it("should return user purchases including plan", async () => {
      mockDatabaseService.userPurchase.findMany.mockResolvedValue([
        { planType: PlanType.N5, plan: PLAN_CONFIGS[PlanType.N5] },
      ]);

      const purchases = await service.getUserPurchases("user-1");
      expect(purchases.length).toBe(1);
      expect(mockDatabaseService.userPurchase.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { purchasedAt: "desc" },
        include: { plan: true },
      });
    });
  });

  describe("adminGetAllPlans", () => {
    it("should return all plans ordered by category and price", async () => {
      mockDatabaseService.paymentPlan.findMany.mockResolvedValue(
        Object.values(PLAN_CONFIGS),
      );

      const plans = await service.adminGetAllPlans();
      expect(plans.length).toBe(7);
      expect(mockDatabaseService.paymentPlan.findMany).toHaveBeenCalledWith({
        orderBy: [{ category: "asc" }, { price: "asc" }],
      });
    });
  });

  describe("adminUpdatePlan", () => {
    it("should throw NotFoundException if plan does not exist", async () => {
      mockDatabaseService.paymentPlan.findUnique.mockResolvedValue(null);

      await expect(
        service.adminUpdatePlan(PlanType.N5, { price: 599 }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should update and return the updated plan", async () => {
      mockDatabaseService.paymentPlan.findUnique.mockResolvedValue(
        PLAN_CONFIGS[PlanType.N5],
      );
      mockDatabaseService.paymentPlan.update.mockResolvedValue({
        ...PLAN_CONFIGS[PlanType.N5],
        price: 599,
      });

      const updated = await service.adminUpdatePlan(PlanType.N5, {
        price: 599,
      });
      expect(updated.price).toBe(599);
      expect(mockDatabaseService.paymentPlan.update).toHaveBeenCalledWith({
        where: { planType: PlanType.N5 },
        data: { price: 599 },
      });
    });
  });
});
