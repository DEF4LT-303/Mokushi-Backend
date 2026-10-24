import { ForbiddenException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { JlptLevel, PlanType, Role } from "@prisma/client";
import { CacheService } from "src/common/services/cache.service";
import { DatabaseService } from "src/database/database.service";
import { RapidFireService } from "./rapid-fire.service";

describe("RapidFireService", () => {
  let service: RapidFireService;
  let databaseService: any;
  let cacheService: any;

  beforeEach(async () => {
    databaseService = {
      rapidFireLesson: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      rapidFireLessonStat: {
        findMany: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      rapidFireOverallStat: {
        upsert: jest.fn(),
        update: jest.fn(),
      },
      hardWord: {
        findMany: jest.fn(),
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      userPurchase: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((val) => val),
    };

    cacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RapidFireService,
        {
          provide: DatabaseService,
          useValue: databaseService,
        },
        {
          provide: CacheService,
          useValue: cacheService,
        },
      ],
    }).compile();

    service = module.get<RapidFireService>(RapidFireService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getCombinedStats", () => {
    it("should fetch stats from database if not cached", async () => {
      const mockOverall = {
        id: "overall-1",
        userId: "user-1",
        jlptLevel: "N5",
      };
      databaseService.rapidFireOverallStat.upsert.mockResolvedValue(
        mockOverall,
      );
      databaseService.rapidFireLesson.findMany.mockResolvedValue([]);
      databaseService.rapidFireLessonStat.findMany.mockResolvedValue([]);
      databaseService.hardWord.findMany.mockResolvedValue([]);

      const result = await service.getCombinedStats("user-1", "N5" as any);
      expect(result).toBeDefined();
      expect(cacheService.get).toHaveBeenCalled();
      expect(cacheService.set).toHaveBeenCalled();
    });
  });

  describe("getLessonDetail - Premium Access Control", () => {
    const mockLessonN5 = {
      id: "rf-lesson-1",
      title: "N5 Lesson 1",
      lessonNumber: 1,
      jlptLevel: JlptLevel.N5,
      isPremium: true,
      words: [
        {
          id: "w-1",
          word: "猫",
          reading: "ねこ",
          romaji: "neko",
          meaning: "cat",
        },
      ],
    };

    const mockOverallStat = {
      id: "ov-1",
      userId: "user-1",
      jlptLevel: JlptLevel.N5,
      masteryRate: 0,
      totalHardWords: 0,
      totalLessons: 25,
      totalAnswers: 0,
      totalCorrect: 0,
      lessonsPracticed: [],
    };

    const mockLessonStat = {
      id: "ls-1",
      overallStatId: "ov-1",
      rapidFireLessonId: "rf-lesson-1",
      userId: "user-1",
      lessonNumber: 1,
      totalWords: 1,
      masteryRate: 0,
      totalAnswers: 0,
      totalCorrect: 0,
    };

    it("should allow regular user if lesson is not premium", async () => {
      databaseService.rapidFireLesson.findUnique.mockResolvedValue({
        ...mockLessonN5,
        isPremium: false,
      });
      databaseService.rapidFireOverallStat.upsert.mockResolvedValue(
        mockOverallStat,
      );
      databaseService.rapidFireLessonStat.upsert.mockResolvedValue(
        mockLessonStat,
      );
      databaseService.hardWord.findMany.mockResolvedValue([]);

      const user = { id: "user-1", role: Role.USER };
      const result = await service.getLessonDetail(
        "user-1",
        "rf-lesson-1",
        user,
      );

      expect(result).toBeDefined();
      expect(result.isPremium).toBe(false);
    });

    it("should throw ForbiddenException for regular user without plan on premium lesson", async () => {
      databaseService.rapidFireLesson.findUnique.mockResolvedValue(
        mockLessonN5,
      );
      databaseService.userPurchase.findMany.mockResolvedValue([]);

      const user = { id: "user-1", role: Role.USER };
      await expect(
        service.getLessonDetail("user-1", "rf-lesson-1", user),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should allow access with RAPID_FIRE_N5 plan on premium N5 lesson", async () => {
      databaseService.rapidFireLesson.findUnique.mockResolvedValue(
        mockLessonN5,
      );
      databaseService.userPurchase.findMany.mockResolvedValue([
        { planType: PlanType.RAPID_FIRE_N5 },
      ]);
      databaseService.rapidFireOverallStat.upsert.mockResolvedValue(
        mockOverallStat,
      );
      databaseService.rapidFireLessonStat.upsert.mockResolvedValue(
        mockLessonStat,
      );
      databaseService.hardWord.findMany.mockResolvedValue([]);

      const user = { id: "user-1", role: Role.USER };
      const result = await service.getLessonDetail(
        "user-1",
        "rf-lesson-1",
        user,
      );

      expect(result).toBeDefined();
      expect(result.isPremium).toBe(true);
    });

    it("should allow access with N5_RAPID_FIRE_BUNDLE on premium N5 lesson", async () => {
      databaseService.rapidFireLesson.findUnique.mockResolvedValue(
        mockLessonN5,
      );
      databaseService.userPurchase.findMany.mockResolvedValue([
        { planType: PlanType.N5_RAPID_FIRE_BUNDLE },
      ]);
      databaseService.rapidFireOverallStat.upsert.mockResolvedValue(
        mockOverallStat,
      );
      databaseService.rapidFireLessonStat.upsert.mockResolvedValue(
        mockLessonStat,
      );
      databaseService.hardWord.findMany.mockResolvedValue([]);

      const user = { id: "user-1", role: Role.USER };
      const result = await service.getLessonDetail(
        "user-1",
        "rf-lesson-1",
        user,
      );

      expect(result).toBeDefined();
    });

    it("should allow ADMIN access to premium lesson without purchases", async () => {
      databaseService.rapidFireLesson.findUnique.mockResolvedValue(
        mockLessonN5,
      );
      databaseService.rapidFireOverallStat.upsert.mockResolvedValue(
        mockOverallStat,
      );
      databaseService.rapidFireLessonStat.upsert.mockResolvedValue(
        mockLessonStat,
      );
      databaseService.hardWord.findMany.mockResolvedValue([]);

      const adminUser = { id: "admin-1", role: Role.ADMIN };
      const result = await service.getLessonDetail(
        "admin-1",
        "rf-lesson-1",
        adminUser,
      );

      expect(result).toBeDefined();
    });
  });
});
