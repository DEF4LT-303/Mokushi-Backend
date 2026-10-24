import { Test, TestingModule } from "@nestjs/testing";
import { UserAttemptsService } from "./user-attempts.service";
import { DatabaseService } from "src/database/database.service";
import { LeaderboardService } from "src/leaderboard/leaderboard.service";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";

describe("UserAttemptsService", () => {
  let service: UserAttemptsService;
  let databaseService: any;
  let leaderboardService: any;

  beforeEach(async () => {
    databaseService = {
      userAttempt: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
      },
      userAnswer: {
        createMany: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      quizQuestion: {
        count: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((val) => {
        if (typeof val === "function") {
          return val(databaseService);
        }
        return val;
      }),
    };

    leaderboardService = {
      onAttemptCompleted: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserAttemptsService,
        {
          provide: DatabaseService,
          useValue: databaseService,
        },
        {
          provide: LeaderboardService,
          useValue: leaderboardService,
        },
      ],
    }).compile();

    service = module.get<UserAttemptsService>(UserAttemptsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("createAttempt", () => {
    it("should create a new attempt with score 0 and status ONGOING", async () => {
      const dto: any = { userId: "user-1", quizId: "quiz-1" };
      databaseService.userAttempt.create.mockResolvedValue({
        id: "att-1",
        ...dto,
        score: 0,
        status: "ONGOING",
      });

      const result = await service.createAttempt(dto);
      expect(result.score).toBe(0);
      expect(result.status).toBe("ONGOING");
    });
  });

  describe("submitQuizAnswers", () => {
    it("should throw NotFoundException if attempt is not found", async () => {
      databaseService.userAttempt.findUnique.mockResolvedValue(null);
      await expect(
        service.submitQuizAnswers("invalid-att", []),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("cancelAttempt", () => {
    it("should throw NotFoundException if attempt is not found", async () => {
      databaseService.userAttempt.findUnique.mockResolvedValue(null);
      await expect(
        service.cancelAttempt("invalid-att", "user-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ForbiddenException if user is not the owner of the attempt", async () => {
      databaseService.userAttempt.findUnique.mockResolvedValue({
        id: "att-1",
        userId: "user-2",
        status: "ONGOING",
      });
      await expect(service.cancelAttempt("att-1", "user-1")).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("should throw BadRequestException if attempt is already completed", async () => {
      databaseService.userAttempt.findUnique.mockResolvedValue({
        id: "att-1",
        userId: "user-1",
        status: "COMPLETED",
      });
      await expect(service.cancelAttempt("att-1", "user-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw BadRequestException if attempt is already cancelled", async () => {
      databaseService.userAttempt.findUnique.mockResolvedValue({
        id: "att-1",
        userId: "user-1",
        status: "CANCELLED",
      });
      await expect(service.cancelAttempt("att-1", "user-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should update attempt status to CANCELLED if all validations pass", async () => {
      databaseService.userAttempt.findUnique.mockResolvedValue({
        id: "att-1",
        userId: "user-1",
        status: "ONGOING",
      });
      databaseService.userAttempt.update.mockResolvedValue({
        id: "att-1",
        status: "CANCELLED",
      });

      const result = await service.cancelAttempt("att-1", "user-1");
      expect(databaseService.userAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "att-1" },
          data: expect.objectContaining({ status: "CANCELLED" }),
        }),
      );
      expect(result).toEqual({
        success: true,
        message: "Quiz attempt cancelled successfully",
      });
    });
  });

  describe("getQuizHistory", () => {
    it("should query for COMPLETED and CANCELLED attempts by default and map cancelled quizzes correctly", async () => {
      const mockAttempts = [
        {
          id: "att-1",
          quizId: "quiz-1",
          status: "COMPLETED",
          score: 8,
          startedAt: new Date("2026-01-01T10:00:00Z"),
          submittedAt: new Date("2026-01-01T10:05:00Z"),
          quiz: {
            module: { categoryType: "GRAMMAR" },
          },
        },
        {
          id: "att-2",
          quizId: "quiz-1",
          status: "CANCELLED",
          score: 0,
          startedAt: new Date("2026-01-01T11:00:00Z"),
          submittedAt: new Date("2026-01-01T11:01:00Z"),
          quiz: {
            module: { categoryType: "GRAMMAR" },
          },
        },
      ];

      databaseService.userAttempt.count.mockResolvedValue(2);
      databaseService.userAttempt.findMany.mockResolvedValue(mockAttempts);
      databaseService.quizQuestion.groupBy.mockResolvedValue([
        { quizId: "quiz-1", _count: { _all: 10 } },
      ]);

      const result = await service.getQuizHistory("user-1");

      expect(databaseService.userAttempt.count).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          status: { in: ["COMPLETED", "CANCELLED"] },
        },
      });

      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toMatchObject({
        id: "att-1",
        status: "COMPLETED",
        performance: "EXCELLENT",
      });
      expect(result.data[1]).toMatchObject({
        id: "att-2",
        status: "CANCELLED",
        performance: "CANCELLED",
      });
    });

    it("should allow filtering by a specific status", async () => {
      databaseService.userAttempt.count.mockResolvedValue(0);
      databaseService.userAttempt.findMany.mockResolvedValue([]);
      databaseService.quizQuestion.groupBy.mockResolvedValue([]);

      await service.getQuizHistory(
        "user-1",
        10,
        0,
        undefined,
        "CANCELLED" as any,
      );

      expect(databaseService.userAttempt.count).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          status: "CANCELLED",
        },
      });
    });
  });

  describe("getQuizHistoryDetail", () => {
    it("should throw NotFoundException if attempt is not found", async () => {
      databaseService.userAttempt.findUnique.mockResolvedValue(null);
      await expect(service.getQuizHistoryDetail("missing-att")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw NotFoundException if attempt is still ONGOING", async () => {
      databaseService.userAttempt.findUnique.mockResolvedValue({
        id: "att-ongoing",
        status: "ONGOING",
      });
      await expect(service.getQuizHistoryDetail("att-ongoing")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should return detailed history for a CANCELLED attempt with status", async () => {
      const mockCancelledAttempt = {
        id: "att-cancelled",
        quizId: "quiz-1",
        status: "CANCELLED",
        score: 0,
        startedAt: new Date("2026-01-01T10:00:00Z"),
        submittedAt: new Date("2026-01-01T10:01:00Z"),
        quiz: {
          module: { id: "mod-1" },
          quizConfig: null,
        },
        userAnswers: [],
      };

      databaseService.userAttempt.findUnique.mockResolvedValue(
        mockCancelledAttempt,
      );
      databaseService.quizQuestion.count.mockResolvedValue(10);

      const result = await service.getQuizHistoryDetail("att-cancelled");

      expect(result.success).toBe(true);
      expect(result.submission.status).toBe("CANCELLED");
      expect(result.submission.score).toBe(0);
      expect(result.submission.totalQuestions).toBe(10);
      expect(result.submission.results).toEqual([]);
    });
  });
});
