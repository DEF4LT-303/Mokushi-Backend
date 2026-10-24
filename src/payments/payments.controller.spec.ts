import { Test, TestingModule } from "@nestjs/testing";
import { PlanType } from "@prisma/client";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

describe("PaymentsController", () => {
  let controller: PaymentsController;
  let mockPaymentsService: any;

  beforeEach(async () => {
    mockPaymentsService = {
      getAvailablePlans: jest.fn().mockReturnValue([]),
      initiatePayment: jest.fn().mockResolvedValue({
        gatewayUrl: "https://sandbox.sslcommerz.com/gwprocess/v4/test",
        tranId: "MK_123",
      }),
      validateAndFulfillPayment: jest.fn().mockResolvedValue(true),
      handlePaymentFailure: jest.fn().mockResolvedValue(undefined),
      handlePaymentCancel: jest.fn().mockResolvedValue(undefined),
      getUserPurchases: jest.fn().mockResolvedValue([]),
      getUserTransactions: jest.fn().mockResolvedValue([]),
      adminGetSubscriptions: jest.fn().mockResolvedValue({ total: 1, count: 1, subscriptions: [] }),
      adminGetUserSubscriptions: jest.fn().mockResolvedValue({
        user: { id: "user-123" },
        accessSummary: { hasFullAccess: false, hasN5: true, hasN4: false, hasRapidFire: false },
        purchases: [],
        transactions: [],
      }),
      adminGetAllTransactions: jest.fn().mockResolvedValue({ total: 1, count: 1, transactions: [] }),
      adminValidatePurchase: jest.fn().mockResolvedValue({ message: "Purchase successfully validated" }),
      adminInvalidatePurchase: jest.fn().mockResolvedValue({ message: "Purchase successfully invalidated" }),
      adminGetAuditLogs: jest.fn().mockResolvedValue({ total: 1, count: 1, logs: [] }),
      reconcilePendingTransactions: jest.fn().mockResolvedValue({
        checked: 1,
        fulfilled: 1,
        expired: 0,
        failed: 0,
      }),
      getFrontendRedirectUrl: jest.fn(
        (status, tranId) =>
          `http://localhost:5173/payment-status?status=${status}&tran_id=${tranId}`,
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        {
          provide: PaymentsService,
          useValue: mockPaymentsService,
        },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("getPlans", () => {
    it("should return plans from service", () => {
      controller.getPlans();
      expect(mockPaymentsService.getAvailablePlans).toHaveBeenCalled();
    });
  });

  describe("initiatePayment", () => {
    it("should call initiatePayment with user id and dto", async () => {
      const user = { id: "user-123" };
      const dto = { planType: PlanType.N5_BUNDLE };

      const result = await controller.initiatePayment(user, dto);
      expect(mockPaymentsService.initiatePayment).toHaveBeenCalledWith(
        "user-123",
        dto,
      );
      expect(result.tranId).toBe("MK_123");
    });
  });

  describe("handleSuccess", () => {
    it("should validate, fulfill and redirect to frontend success url", async () => {
      const mockRes: any = {
        redirect: jest.fn(),
      };
      const body = { tran_id: "MK_123", val_id: "VAL_123", card_type: "BKASH" };

      await controller.handleSuccess(body, mockRes);

      expect(
        mockPaymentsService.validateAndFulfillPayment,
      ).toHaveBeenCalledWith("VAL_123", "MK_123", "BKASH");
      expect(mockRes.redirect).toHaveBeenCalledWith(
        "http://localhost:5173/payment-status?status=success&tran_id=MK_123",
      );
    });

    it("should fallback to query parameters if body is empty", async () => {
      const mockRes: any = {
        redirect: jest.fn(),
      };
      const query = { tran_id: "MK_QUERY", val_id: "VAL_QUERY", card_type: "NAGAD" };

      await controller.handleSuccess({}, mockRes, query);

      expect(
        mockPaymentsService.validateAndFulfillPayment,
      ).toHaveBeenCalledWith("VAL_QUERY", "MK_QUERY", "NAGAD");
    });

    it("should support handleSuccessGet fallback", async () => {
      const mockRes: any = {
        redirect: jest.fn(),
      };
      const query = { tran_id: "MK_GET", val_id: "VAL_GET" };

      await controller.handleSuccessGet(mockRes, query);

      expect(
        mockPaymentsService.validateAndFulfillPayment,
      ).toHaveBeenCalledWith("VAL_GET", "MK_GET", undefined);
    });
  });

  describe("handleFail", () => {
    it("should update failure and redirect to frontend failure url", async () => {
      const mockRes: any = {
        redirect: jest.fn(),
      };
      const body = { tran_id: "MK_123" };

      await controller.handleFail(body, mockRes);

      expect(mockPaymentsService.handlePaymentFailure).toHaveBeenCalledWith(
        "MK_123",
      );
      expect(mockRes.redirect).toHaveBeenCalledWith(
        "http://localhost:5173/payment-status?status=failed&tran_id=MK_123",
      );
    });
  });

  describe("handleCancel", () => {
    it("should update cancelled status and redirect to frontend cancel url", async () => {
      const mockRes: any = {
        redirect: jest.fn(),
      };
      const body = { tran_id: "MK_123" };

      await controller.handleCancel(body, mockRes);

      expect(mockPaymentsService.handlePaymentCancel).toHaveBeenCalledWith(
        "MK_123",
      );
      expect(mockRes.redirect).toHaveBeenCalledWith(
        "http://localhost:5173/payment-status?status=cancelled&tran_id=MK_123",
      );
    });
  });

  describe("handleIpn", () => {
    it("should handle valid IPN webhook", async () => {
      const body = {
        status: "VALID",
        tran_id: "MK_123",
        val_id: "VAL_123",
        card_type: "BKASH",
      };

      const result = await controller.handleIpn(body);

      expect(
        mockPaymentsService.validateAndFulfillPayment,
      ).toHaveBeenCalledWith("VAL_123", "MK_123", "BKASH");
      expect(result).toEqual({ message: "IPN received successfully" });
    });
  });

  describe("getMyPurchases and getMyTransactions", () => {
    it("should fetch user purchases", async () => {
      await controller.getMyPurchases({ id: "user-123" });
      expect(mockPaymentsService.getUserPurchases).toHaveBeenCalledWith(
        "user-123",
      );
    });

    it("should fetch user transactions", async () => {
      await controller.getMyTransactions({ id: "user-123" });
      expect(mockPaymentsService.getUserTransactions).toHaveBeenCalledWith(
        "user-123",
      );
    });
  });

  describe("Admin Endpoints", () => {
    it("should call adminGetSubscriptions with parsed query params", async () => {
      await controller.adminGetSubscriptions("0", "10", "user-1", PlanType.N5_BUNDLE, "test");
      expect(mockPaymentsService.adminGetSubscriptions).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        userId: "user-1",
        planType: PlanType.N5_BUNDLE,
        search: "test",
      });
    });

    it("should call adminGetUserSubscriptions with userId", async () => {
      const result = await controller.adminGetUserSubscriptions("user-123");
      expect(mockPaymentsService.adminGetUserSubscriptions).toHaveBeenCalledWith("user-123");
      expect(result.user.id).toBe("user-123");
    });

    it("should call adminGetAllTransactions with parsed query params", async () => {
      await controller.adminGetAllTransactions("0", "20", "user-123", undefined);
      expect(mockPaymentsService.adminGetAllTransactions).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        userId: "user-123",
        status: undefined,
      });
    });

    it("should call adminValidatePurchase with dto and adminId", async () => {
      const dto = {
        userId: "user-123",
        planType: PlanType.N5_BUNDLE,
        tranId: "MK_123",
        reason: "Offline cash",
      };
      const result = await controller.adminValidatePurchase({ id: "admin-1" }, dto);
      expect(mockPaymentsService.adminValidatePurchase).toHaveBeenCalledWith(dto, "admin-1");
      expect(result.message).toBe("Purchase successfully validated");
    });

    it("should call adminInvalidatePurchase with dto and adminId", async () => {
      const dto = {
        userId: "user-123",
        planType: PlanType.N5_BUNDLE,
        reason: "Customer requested refund",
      };
      const result = await controller.adminInvalidatePurchase({ id: "admin-1" }, dto);
      expect(mockPaymentsService.adminInvalidatePurchase).toHaveBeenCalledWith(dto, "admin-1");
      expect(result.message).toBe("Purchase successfully invalidated");
    });

    it("should call adminGetAuditLogs with parsed query params", async () => {
      await controller.adminGetAuditLogs(
        "0",
        "10",
        "admin-1",
        "user-123",
        "PURCHASE_REVOKED",
      );
      expect(mockPaymentsService.adminGetAuditLogs).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        adminId: "admin-1",
        targetId: "user-123",
        action: "PURCHASE_REVOKED",
      });
    });

    it("should call adminTriggerReconcile and return reconciliation summary", async () => {
      const result = await controller.adminTriggerReconcile();
      expect(
        mockPaymentsService.reconcilePendingTransactions,
      ).toHaveBeenCalled();
      expect(result.fulfilled).toBe(1);
    });
  });
});
