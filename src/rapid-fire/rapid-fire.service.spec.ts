import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { JlptLevel, PlanType, Role } from "@prisma/client";
import { CacheService } from "src/common/services/cache.service";
import { DatabaseService } from "src/database/database.service";
import { RapidFireService } from "./rapid-fire.service";

describe("RapidFireService", () => {
  let service: RapidFireService;
  let databaseService: any;
  let cacheService: any;

  const mockLessonN5 = {
    id: "rf-lesson-1",
    title: "N5 Lesson 1",
    lessonNumber: 1,
    isPremium: true,
    jlptLevel: JlptLevel.N5,
    words: [
      {
        id: "word-1",
        word: "食べる",
        reading: "たべる",
        romaji: "taberu",
        meaning: "to eat",
      },
    ],
  };

  beforeEach(async () => {
    databaseService = {
      rapidFireLesson: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      rapidFireWord: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
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
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        createMany: jest.fn(),
        deleteMany: jest.fn(),
        count: jest.fn(),
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

  describe("getAllLessons", () => {
    it("should return all lessons with word count and unlocked status", async () => {
      databaseService.rapidFireLesson.findMany.mockResolvedValue([
        {
          id: "lesson-1",
          title: "Lesson 1: Vocabulary",
          lessonNumber: 1,
          jlptLevel: JlptLevel.N5,
          isPremium: false,
          _count: { words: 34 },
        },
        {
          id: "lesson-6",
          title: "Lesson 6: Vocabulary",
          lessonNumber: 6,
          jlptLevel: JlptLevel.N5,
          isPremium: true,
          _count: { words: 28 },
        },
      ]);
      databaseService.userPurchase.findMany.mockResolvedValue([]);

      const lessons = await service.getAllLessons(
        { jlptLevel: JlptLevel.N5 },
        "user-1",
        { role: Role.USER },
      );

      expect(lessons.length).toBe(2);
      expect(lessons[0].wordCount).toBe(34);
      expect(lessons[0].isUnlocked).toBe(true);
      expect(lessons[1].wordCount).toBe(28);
      expect(lessons[1].isUnlocked).toBe(false);
    });
  });

  describe("getLessonById", () => {
    it("should throw NotFoundException if lesson does not exist", async () => {
      databaseService.rapidFireLesson.findUnique.mockResolvedValue(null);

      await expect(service.getLessonById("non-existent")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should return lesson metadata when found", async () => {
      databaseService.rapidFireLesson.findUnique.mockResolvedValue({
        id: "lesson-1",
        title: "Lesson 1: Vocabulary",
        lessonNumber: 1,
        jlptLevel: JlptLevel.N5,
        isPremium: false,
        _count: { words: 34 },
      });

      const lesson = await service.getLessonById("lesson-1");
      expect(lesson.title).toBe("Lesson 1: Vocabulary");
      expect(lesson.wordCount).toBe(34);
      expect(lesson.isUnlocked).toBe(true);
    });
  });

  describe("getRapidFireWordsForLesson", () => {
    it("should throw ForbiddenException if user has no access to premium lesson", async () => {
      databaseService.rapidFireLesson.findUnique.mockResolvedValue(mockLessonN5);
      databaseService.userPurchase.findMany.mockResolvedValue([]);

      const regularUser = { id: "user-1", role: Role.USER };
      await expect(
        service.getRapidFireWordsForLesson("rf-lesson-1", "user-1", regularUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should return words for free lesson with hard marks if authenticated", async () => {
      databaseService.rapidFireLesson.findUnique.mockResolvedValue({
        ...mockLessonN5,
        isPremium: false,
      });
      databaseService.hardWord.findMany.mockResolvedValue([
        { rapidFireWordId: "word-1" },
      ]);

      const words = await service.getRapidFireWordsForLesson(
        "rf-lesson-1",
        "user-1",
      );

      expect(words.length).toBe(1);
      expect(words[0].isHard).toBe(true);
    });
  });

  describe("getWordById and searchWords", () => {
    it("should return word by id with lesson info", async () => {
      databaseService.rapidFireWord.findUnique.mockResolvedValue({
        id: "w-1",
        word: "私",
        reading: "わたし",
        romaji: "watashi",
        meaning: "I",
        rapidFireLessonId: "l-1",
        rapidFireLesson: {
          title: "Lesson 1: Vocabulary",
          lessonNumber: 1,
          jlptLevel: JlptLevel.N5,
          isPremium: false,
        },
      });
      databaseService.hardWord.findUnique.mockResolvedValue({ id: "hw-1" });

      const word = await service.getWordById("w-1", "user-1");
      expect(word.word).toBe("私");
      expect(word.lessonNumber).toBe(1);
      expect(word.isHard).toBe(true);
    });

    it("should search words with query filters", async () => {
      databaseService.rapidFireWord.count.mockResolvedValue(1);
      databaseService.rapidFireWord.findMany.mockResolvedValue([
        {
          id: "w-1",
          word: "私",
          reading: "わたし",
          romaji: "watashi",
          meaning: "I",
          rapidFireLessonId: "l-1",
          rapidFireLesson: {
            title: "Lesson 1: Vocabulary",
            lessonNumber: 1,
            jlptLevel: JlptLevel.N5,
            isPremium: false,
          },
        },
      ]);
      databaseService.hardWord.findMany.mockResolvedValue([]);

      const result = await service.searchWords({ search: "watashi" }, "user-1");
      expect(result.total).toBe(1);
      expect(result.words.length).toBe(1);
      expect(result.words[0].word).toBe("私");
    });
  });

  describe("Hard Words (Bookmarks)", () => {
    it("should get user hard words", async () => {
      databaseService.hardWord.findMany.mockResolvedValue([
        {
          id: "hw-1",
          rapidFireWord: {
            id: "w-1",
            word: "先生",
            reading: "せんせい",
            romaji: "sensei",
            meaning: "teacher",
            rapidFireLessonId: "l-1",
            rapidFireLesson: {
              title: "Lesson 1: Vocabulary",
              lessonNumber: 1,
              jlptLevel: JlptLevel.N5,
              isPremium: false,
            },
          },
        },
      ]);

      const result = await service.getUserHardWords("user-1");
      expect(result.total).toBe(1);
      expect(result.hardWords[0].word).toBe("先生");
      expect(result.hardWords[0].isHard).toBe(true);
    });

    it("should toggle hard word from not hard to hard", async () => {
      databaseService.rapidFireWord.findUnique.mockResolvedValue({
        id: "w-1",
        rapidFireLesson: { jlptLevel: JlptLevel.N5 },
      });
      databaseService.hardWord.findUnique.mockResolvedValue(null);
      databaseService.hardWord.create.mockResolvedValue({});
      databaseService.hardWord.count.mockResolvedValue(1);
      databaseService.rapidFireOverallStat.upsert.mockResolvedValue({});

      const result = await service.toggleHardWord("user-1", "w-1");
      expect(result.isHard).toBe(true);
      expect(result.totalHardWords).toBe(1);
      expect(databaseService.hardWord.create).toHaveBeenCalledWith({
        data: { userId: "user-1", rapidFireWordId: "w-1" },
      });
    });

    it("should toggle hard word from hard to not hard", async () => {
      databaseService.rapidFireWord.findUnique.mockResolvedValue({
        id: "w-1",
        rapidFireLesson: { jlptLevel: JlptLevel.N5 },
      });
      databaseService.hardWord.findUnique.mockResolvedValue({ id: "hw-1" });
      databaseService.hardWord.delete.mockResolvedValue({});
      databaseService.hardWord.count.mockResolvedValue(0);
      databaseService.rapidFireOverallStat.upsert.mockResolvedValue({});

      const result = await service.toggleHardWord("user-1", "w-1");
      expect(result.isHard).toBe(false);
      expect(result.totalHardWords).toBe(0);
      expect(databaseService.hardWord.delete).toHaveBeenCalledWith({
        where: { id: "hw-1" },
      });
    });
  });
});
