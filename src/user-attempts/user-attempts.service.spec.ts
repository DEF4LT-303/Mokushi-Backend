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
});
