import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { JlptLevel, PlanType, Role } from "@prisma/client";
import { DatabaseService } from "src/database/database.service";
import { ModuleService } from "./module.service";

describe("ModuleService", () => {
  let service: ModuleService;
  let databaseService: any;

  beforeEach(async () => {
    const mockDatabaseService = {
      module: {
        findUnique: jest.fn(),
      },
      lesson: {
        findUnique: jest.fn(),
      },
      grammarRule: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      userPurchase: {
        findMany: jest.fn(),
      },
      quizConfig: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      question: {
        findMany: jest.fn(),
      },
      quiz: {
        create: jest.fn(),
      },
      quizQuestion: {
        createMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModuleService,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get<ModuleService>(ModuleService);
    databaseService = module.get(DatabaseService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should throw when creating a rule for a missing lesson", async () => {
    databaseService.lesson.findUnique.mockResolvedValue(null);

    await expect(
      service.createRule("missing-lesson", {
        japanese: "日本語",
        englishTitle: "Japanese",
        description: "Example rule",
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it("should create nested examples when examples are provided in the same request body", async () => {
    databaseService.lesson.findUnique.mockResolvedValue({ id: "lesson-1" });
    databaseService.grammarRule.create.mockResolvedValue({ id: "rule-1" });

    await service.createRule("lesson-1", {
      japanese: "日本語",
      englishTitle: "Japanese",
      description: "Example rule",
      examples: [
        {
          japaneseSentence: "日本語です。",
          englishTranslation: "This is Japanese.",
        },
      ],
    } as any);

    expect(databaseService.grammarRule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lessonId: "lesson-1",
          examples: {
            create: [
              {
                japaneseSentence: "日本語です。",
                englishTranslation: "This is Japanese.",
              },
            ],
          },
        }),
      }),
    );
  });

  describe("getQuizByModule - Premium Access Control", () => {
    const mockModuleN5 = {
      id: "mod-n5",
      slug: "n5-basics",
      name: "N5 Basics",
      description: "Basic grammar",
      jlptLevel: JlptLevel.N5,
      categoryType: "GRAMMAR",
      isPremium: true,
    };

    const mockQuizConfig = {
      id: "cfg-1",
      moduleId: "mod-n5",
      name: "Standard Quiz",
      numQuestions: 1,
      durationSec: 300,
    };

    const mockQuestion = {
      id: "q-1",
      content: "Choose correct particle",
      options: ["は", "が"],
      questionType: "GRAMMAR",
    };

    const mockQuiz = {
      id: "quiz-1",
      title: "N5 Basics - Standard Quiz",
      durationSec: 300,
      moduleId: "mod-n5",
      quizConfigId: "cfg-1",
      questions: [
        {
          id: "qq-1",
          order: 1,
          question: mockQuestion,
        },
      ],
    };

    it("should allow regular user if module is not premium", async () => {
      databaseService.module.findUnique.mockResolvedValue({
        ...mockModuleN5,
        isPremium: false,
      });
      databaseService.quizConfig.findUnique.mockResolvedValue(mockQuizConfig);
      databaseService.question.findMany.mockResolvedValue([mockQuestion]);
      databaseService.quiz.create.mockResolvedValue(mockQuiz);

      const user = { id: "user-1", role: Role.USER };
      const result = await service.getQuizByModule("mod-n5", "cfg-1", user);

      expect(result).toBeDefined();
      expect(result.module.isPremium).toBe(false);
    });

    it("should reject regular user without plan for premium module", async () => {
      databaseService.module.findUnique.mockResolvedValue(mockModuleN5);
      databaseService.quizConfig.findUnique.mockResolvedValue(mockQuizConfig);
      databaseService.userPurchase.findMany.mockResolvedValue([]);

      const user = { id: "user-1", role: Role.USER };
      await expect(
        service.getQuizByModule("mod-n5", "cfg-1", user),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should allow regular user with N5 plan for premium N5 module", async () => {
      databaseService.module.findUnique.mockResolvedValue(mockModuleN5);
      databaseService.quizConfig.findUnique.mockResolvedValue(mockQuizConfig);
      databaseService.userPurchase.findMany.mockResolvedValue([
        { planType: PlanType.N5 },
      ]);
      databaseService.question.findMany.mockResolvedValue([mockQuestion]);
      databaseService.quiz.create.mockResolvedValue(mockQuiz);

      const user = { id: "user-1", role: Role.USER };
      const result = await service.getQuizByModule("mod-n5", "cfg-1", user);

      expect(result).toBeDefined();
    });

    it("should allow regular user with N5_RAPID_FIRE_BUNDLE for premium N5 module", async () => {
      databaseService.module.findUnique.mockResolvedValue(mockModuleN5);
      databaseService.quizConfig.findUnique.mockResolvedValue(mockQuizConfig);
      databaseService.userPurchase.findMany.mockResolvedValue([
        { planType: PlanType.N5_RAPID_FIRE_BUNDLE },
      ]);
      databaseService.question.findMany.mockResolvedValue([mockQuestion]);
      databaseService.quiz.create.mockResolvedValue(mockQuiz);

      const user = { id: "user-1", role: Role.USER };
      const result = await service.getQuizByModule("mod-n5", "cfg-1", user);

      expect(result).toBeDefined();
    });

    it("should allow admin for any premium module without purchases", async () => {
      databaseService.module.findUnique.mockResolvedValue(mockModuleN5);
      databaseService.quizConfig.findUnique.mockResolvedValue(mockQuizConfig);
      databaseService.question.findMany.mockResolvedValue([mockQuestion]);
      databaseService.quiz.create.mockResolvedValue(mockQuiz);

      const adminUser = { id: "admin-1", role: Role.ADMIN };
      const result = await service.getQuizByModule(
        "mod-n5",
        "cfg-1",
        adminUser,
      );

      expect(result).toBeDefined();
    });
  });
});
