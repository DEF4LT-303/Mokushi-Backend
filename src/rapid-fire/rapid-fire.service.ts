import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { JlptLevel, PlanType, Role } from "@prisma/client";
import { CacheService } from "../common/services/cache.service";
import { DatabaseService } from "../database/database.service";
import { RapidFireLessonOverviewDto } from "./dto/lesson-detail.dto";
import { RapidFireLessonStatDto } from "./dto/lesson-stat.dto";
import { OverallStatsDto } from "./dto/overall-stats.dto";
import {
  QueryRapidFireLessonsDto,
  QueryRapidFireWordsDto,
} from "./dto/query-rapid-fire.dto";
import { SubmitRapidFireAnswersResponseDto } from "./dto/rapid-fire-answer-response.dto";
import { SubmitRapidFireAnswersDto } from "./dto/rapid-fire-answer.dto";
import { RapidFireLessonDto } from "./dto/rapid-fire-lesson.dto";
import {
  RapidFireWordDetailDto,
  RapidFireWordDto,
  ToggleHardWordResponseDto,
} from "./dto/rapid-fire-word.dto";

@Injectable()
export class RapidFireService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly cache: CacheService,
  ) {}

  private cacheKey(userId: string, level: JlptLevel) {
    return `rapidfire:stats:${userId}:${level}`;
  }

  async getCombinedStats(userId: string, jlptLevel?: JlptLevel) {
    const level = jlptLevel ?? JlptLevel.N5;
    const cacheKey = this.cacheKey(userId, level);

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const [overall, lessons] = await Promise.all([
      this.getOrCreateOverallStat(userId, level),
      this.databaseService.rapidFireLesson.findMany({
        where: { jlptLevel: level },
        select: {
          id: true,
          title: true,
          lessonNumber: true,
          isPremium: true,
          _count: { select: { words: true } },
        },
        orderBy: { lessonNumber: "asc" },
      }),
    ]);

    const stats = await this.databaseService.rapidFireLessonStat.findMany({
      where: { overallStatId: overall.id },
    });

    // compute hard-word counts per lesson dynamically and collect hard words
    const lessonIds = lessons.map((l: any) => l.id);
    const hardMarks = await this.databaseService.hardWord.findMany({
      where: {
        userId,
        rapidFireWord: { rapidFireLessonId: { in: lessonIds } },
      },
      include: { rapidFireWord: true },
    });

    const hardCountByLesson: Record<string, number> = {};
    const hardWordsByLesson: Record<string, any[]> = {};
    for (const hm of hardMarks) {
      const w = hm.rapidFireWord;
      const lid = w.rapidFireLessonId;
      hardCountByLesson[lid] = (hardCountByLesson[lid] ?? 0) + 1;
      hardWordsByLesson[lid] = hardWordsByLesson[lid] ?? [];
      hardWordsByLesson[lid].push(w);
    }

    const lessonDtos: RapidFireLessonStatDto[] = lessons.map((lesson: any) => {
      const stat = stats.find((s: any) => s.rapidFireLessonId === lesson.id);
      return {
        lessonId: lesson.id,
        lessonNumber: lesson.lessonNumber,
        lessonTitle: lesson.title,
        isPremium: lesson.isPremium,
        totalWords: lesson._count.words,
        masteryRate: stat?.masteryRate ?? 0,
        hardWordCount: hardCountByLesson[lesson.id] ?? 0,
        hardWords: (hardWordsByLesson[lesson.id] ?? []).map((w: any) =>
          this.mapWordToDto(w, true),
        ),
        totalAnswers: stat?.totalAnswers ?? 0,
        totalCorrect: stat?.totalCorrect ?? 0,
        lastPracticed: stat?.lastPracticed
          ? stat.lastPracticed.toISOString()
          : undefined,
      };
    });

    const result = {
      overall: this.mapOverallStatToDto(overall),
      lessons: lessonDtos,
    };

    await this.cache.set(cacheKey, result, 30); // 30s TTL
    return result;
  }

  // Kept for any existing callers; delegates to the shared combined-fetch path where possible.
  async getOverallStats(
    userId: string,
    jlptLevel?: JlptLevel,
  ): Promise<OverallStatsDto> {
    const level = jlptLevel ?? JlptLevel.N5;
    const overall = await this.getOrCreateOverallStat(userId, level);
    return this.mapOverallStatToDto(overall);
  }

  async getLessonStats(
    userId: string,
    jlptLevel?: JlptLevel,
  ): Promise<RapidFireLessonStatDto[]> {
    const level = jlptLevel ?? JlptLevel.N5;
    const combined = await this.getCombinedStats(userId, level);
    return combined.lessons;
  }

  async getLessonDetail(
    userId: string,
    lessonId: string,
    user?: any,
  ): Promise<RapidFireLessonOverviewDto> {
    const rapidFireLesson =
      await this.databaseService.rapidFireLesson.findUnique({
        where: { id: lessonId },
        include: { words: true },
      });

    if (!rapidFireLesson) {
      throw new NotFoundException(
        `Rapid-fire lesson for id '${lessonId}' not found`,
      );
    }

    // Access control: if lesson is premium and user is not admin, verify plan purchase
    if (rapidFireLesson.isPremium && user?.role !== Role.ADMIN) {
      const userPurchases =
        user?.purchases ||
        (await this.databaseService.userPurchase.findMany({
          where: { userId },
          select: { planType: true },
        }));

      const hasAccess =
        (rapidFireLesson.jlptLevel === JlptLevel.N5 &&
          userPurchases.some(
            (p: any) =>
              p.planType === PlanType.RAPID_FIRE_N5 ||
              p.planType === PlanType.N5_RAPID_FIRE_BUNDLE,
          )) ||
        (rapidFireLesson.jlptLevel === JlptLevel.N4 &&
          userPurchases.some(
            (p: any) =>
              p.planType === PlanType.RAPID_FIRE_N4 ||
              p.planType === PlanType.N4_RAPID_FIRE_BUNDLE,
          ));

      if (!hasAccess) {
        throw new ForbiddenException(
          `Rapid-Fire lesson '${rapidFireLesson.title}' is locked. Please unlock the Rapid Fire ${rapidFireLesson.jlptLevel} plan or bundle to practice.`,
        );
      }
    }

    const overallStat = await this.getOrCreateOverallStat(
      userId,
      rapidFireLesson.jlptLevel,
    );
    const lessonStat = await this.getOrCreateLessonStat(
      overallStat.id,
      overallStat.userId,
      rapidFireLesson.id,
      rapidFireLesson.lessonNumber,
      rapidFireLesson.words.length,
    );

    // fetch user's hard-word marks for this lesson
    const hardMarks = await this.databaseService.hardWord.findMany({
      where: {
        userId,
        rapidFireWord: { rapidFireLessonId: rapidFireLesson.id },
      },
      include: { rapidFireWord: true },
    });
    const hardIds = new Set(hardMarks.map((h: any) => h.rapidFireWordId));
    const hardWordsDto = rapidFireLesson.words
      .filter((w: any) => hardIds.has(w.id))
      .map((w: any) => this.mapWordToDto(w, true));

    return {
      lessonId: rapidFireLesson.id,
      lessonTitle: rapidFireLesson.title,
      lessonNumber: rapidFireLesson.lessonNumber,
      isPremium: rapidFireLesson.isPremium,
      jlptLevel: rapidFireLesson.jlptLevel,
      words: rapidFireLesson.words.map((word: any) =>
        this.mapWordToDto(word, hardIds.has(word.id)),
      ),
      lessonStat: this.mapLessonStatToDto(
        { ...lessonStat, rapidFireLesson },
        hardMarks.length,
        hardWordsDto,
      ),
      overallStat: this.mapOverallStatToDto(overallStat),
    };
  }

  async checkUserLessonAccess(
    lesson: { isPremium: boolean; jlptLevel: JlptLevel },
    userId?: string,
    user?: any,
  ): Promise<boolean> {
    if (!lesson.isPremium) {
      return true;
    }
    if (!userId) {
      return false;
    }
    if (user?.role === Role.ADMIN) {
      return true;
    }

    const userPurchases =
      user?.purchases ||
      (await this.databaseService.userPurchase.findMany({
        where: { userId },
        select: { planType: true },
      }));

    return (
      (lesson.jlptLevel === JlptLevel.N5 &&
        userPurchases.some(
          (p: any) =>
            p.planType === PlanType.RAPID_FIRE_N5 ||
            p.planType === PlanType.N5_RAPID_FIRE_BUNDLE,
        )) ||
      (lesson.jlptLevel === JlptLevel.N4 &&
        userPurchases.some(
          (p: any) =>
            p.planType === PlanType.RAPID_FIRE_N4 ||
            p.planType === PlanType.N4_RAPID_FIRE_BUNDLE,
        ))
    );
  }

  async getAllLessons(
    query?: QueryRapidFireLessonsDto,
    userId?: string,
    user?: any,
  ): Promise<RapidFireLessonDto[]> {
    const where: any = {};
    if (query?.jlptLevel) {
      where.jlptLevel = query.jlptLevel;
    }
    if (query?.isPremium !== undefined) {
      where.isPremium = query.isPremium;
    }

    const lessons = await this.databaseService.rapidFireLesson.findMany({
      where,
      orderBy: [{ jlptLevel: "asc" }, { lessonNumber: "asc" }],
      include: {
        _count: { select: { words: true } },
      },
    });

    let userPurchases: any[] = [];
    if (userId && user?.role !== Role.ADMIN) {
      userPurchases =
        user?.purchases ||
        (await this.databaseService.userPurchase.findMany({
          where: { userId },
          select: { planType: true },
        }));
    }

    return lessons.map((lesson) => {
      const isUnlocked =
        !lesson.isPremium ||
        user?.role === Role.ADMIN ||
        (lesson.jlptLevel === JlptLevel.N5 &&
          userPurchases.some(
            (p: any) =>
              p.planType === PlanType.RAPID_FIRE_N5 ||
              p.planType === PlanType.N5_RAPID_FIRE_BUNDLE,
          )) ||
        (lesson.jlptLevel === JlptLevel.N4 &&
          userPurchases.some(
            (p: any) =>
              p.planType === PlanType.RAPID_FIRE_N4 ||
              p.planType === PlanType.N4_RAPID_FIRE_BUNDLE,
          ));

      return {
        id: lesson.id,
        title: lesson.title,
        lessonNumber: lesson.lessonNumber,
        jlptLevel: lesson.jlptLevel,
        isPremium: lesson.isPremium,
        wordCount: lesson._count.words,
        isUnlocked: userId ? isUnlocked : !lesson.isPremium,
      };
    });
  }

  async getLessonById(
    lessonId: string,
    userId?: string,
    user?: any,
  ): Promise<RapidFireLessonDto> {
    const lesson = await this.databaseService.rapidFireLesson.findUnique({
      where: { id: lessonId },
      include: {
        _count: { select: { words: true } },
      },
    });

    if (!lesson) {
      throw new NotFoundException(
        `Rapid-fire lesson for id '${lessonId}' not found`,
      );
    }

    const isUnlocked = await this.checkUserLessonAccess(lesson, userId, user);

    return {
      id: lesson.id,
      title: lesson.title,
      lessonNumber: lesson.lessonNumber,
      jlptLevel: lesson.jlptLevel,
      isPremium: lesson.isPremium,
      wordCount: lesson._count.words,
      isUnlocked,
    };
  }

  async getRapidFireWordsForLesson(
    lessonId: string,
    userId?: string,
    user?: any,
  ): Promise<RapidFireWordDto[]> {
    const rapidFireLesson =
      await this.databaseService.rapidFireLesson.findUnique({
        where: { id: lessonId },
        include: { words: true },
      });

    if (!rapidFireLesson) {
      throw new NotFoundException(
        `Rapid-fire lesson for id '${lessonId}' not found`,
      );
    }

    const hasAccess = await this.checkUserLessonAccess(
      rapidFireLesson,
      userId,
      user,
    );

    if (!hasAccess) {
      throw new ForbiddenException(
        `Rapid-Fire lesson '${rapidFireLesson.title}' is locked. Please unlock the Rapid Fire ${rapidFireLesson.jlptLevel} plan or bundle to view words.`,
      );
    }

    let hardIds = new Set<string>();
    if (userId) {
      const hardMarks = await this.databaseService.hardWord.findMany({
        where: {
          userId,
          rapidFireWord: { rapidFireLessonId: lessonId },
        },
        select: { rapidFireWordId: true },
      });
      hardIds = new Set(hardMarks.map((h: any) => h.rapidFireWordId));
    }

    return rapidFireLesson.words.map((word: any) =>
      this.mapWordToDto(word, hardIds.has(word.id)),
    );
  }

  async getWordById(
    wordId: string,
    userId?: string,
  ): Promise<RapidFireWordDetailDto> {
    const word = await this.databaseService.rapidFireWord.findUnique({
      where: { id: wordId },
      include: {
        rapidFireLesson: true,
      },
    });

    if (!word) {
      throw new NotFoundException(`Word with id '${wordId}' not found`);
    }

    let isHard = false;
    if (userId) {
      const mark = await this.databaseService.hardWord.findUnique({
        where: {
          userId_rapidFireWordId: {
            userId,
            rapidFireWordId: wordId,
          },
        },
      });
      isHard = !!mark;
    }

    return {
      id: word.id,
      word: word.word,
      reading: word.reading,
      romaji: word.romaji,
      meaning: word.meaning,
      rapidFireLessonId: word.rapidFireLessonId,
      lessonTitle: word.rapidFireLesson?.title,
      lessonNumber: word.rapidFireLesson?.lessonNumber,
      jlptLevel: word.rapidFireLesson?.jlptLevel,
      isPremium: word.rapidFireLesson?.isPremium,
      isHard,
    };
  }

  async searchWords(
    query: QueryRapidFireWordsDto,
    userId?: string,
  ): Promise<{ total: number; words: RapidFireWordDetailDto[] }> {
    const { jlptLevel, lessonNumber, search, skip = 0, take = 50 } = query;

    const where: any = {};
    if (jlptLevel || lessonNumber) {
      where.rapidFireLesson = {};
      if (jlptLevel) where.rapidFireLesson.jlptLevel = jlptLevel;
      if (lessonNumber) where.rapidFireLesson.lessonNumber = lessonNumber;
    }

    if (search) {
      where.OR = [
        { word: { contains: search } },
        { reading: { contains: search } },
        { romaji: { contains: search } },
        { meaning: { contains: search } },
      ];
    }

    const [total, words] = await Promise.all([
      this.databaseService.rapidFireWord.count({ where }),
      this.databaseService.rapidFireWord.findMany({
        where,
        skip,
        take,
        orderBy: [
          { rapidFireLesson: { lessonNumber: "asc" } },
          { word: "asc" },
        ],
        include: {
          rapidFireLesson: true,
        },
      }),
    ]);

    let hardIds = new Set<string>();
    if (userId && words.length > 0) {
      const wordIds = words.map((w: any) => w.id);
      const marks = await this.databaseService.hardWord.findMany({
        where: {
          userId,
          rapidFireWordId: { in: wordIds },
        },
        select: { rapidFireWordId: true },
      });
      hardIds = new Set(marks.map((m: any) => m.rapidFireWordId));
    }

    return {
      total,
      words: words.map((w: any) => ({
        id: w.id,
        word: w.word,
        reading: w.reading,
        romaji: w.romaji,
        meaning: w.meaning,
        rapidFireLessonId: w.rapidFireLessonId,
        lessonTitle: w.rapidFireLesson?.title,
        lessonNumber: w.rapidFireLesson?.lessonNumber,
        jlptLevel: w.rapidFireLesson?.jlptLevel,
        isPremium: w.rapidFireLesson?.isPremium,
        isHard: hardIds.has(w.id),
      })),
    };
  }

  async getUserHardWords(
    userId: string,
    jlptLevel?: JlptLevel,
  ): Promise<{ total: number; hardWords: RapidFireWordDetailDto[] }> {
    const where: any = { userId };
    if (jlptLevel) {
      where.rapidFireWord = {
        rapidFireLesson: { jlptLevel },
      };
    }

    const hardMarks = await this.databaseService.hardWord.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        rapidFireWord: {
          include: {
            rapidFireLesson: true,
          },
        },
      },
    });

    return {
      total: hardMarks.length,
      hardWords: hardMarks.map((hm: any) => {
        const w = hm.rapidFireWord;
        return {
          id: w.id,
          word: w.word,
          reading: w.reading,
          romaji: w.romaji,
          meaning: w.meaning,
          rapidFireLessonId: w.rapidFireLessonId,
          lessonTitle: w.rapidFireLesson?.title,
          lessonNumber: w.rapidFireLesson?.lessonNumber,
          jlptLevel: w.rapidFireLesson?.jlptLevel,
          isPremium: w.rapidFireLesson?.isPremium,
          isHard: true,
        };
      }),
    };
  }

  async toggleHardWord(
    userId: string,
    wordId: string,
  ): Promise<ToggleHardWordResponseDto> {
    const word = await this.databaseService.rapidFireWord.findUnique({
      where: { id: wordId },
      include: { rapidFireLesson: true },
    });

    if (!word) {
      throw new NotFoundException(`Word with id '${wordId}' not found`);
    }

    const existing = await this.databaseService.hardWord.findUnique({
      where: {
        userId_rapidFireWordId: {
          userId,
          rapidFireWordId: wordId,
        },
      },
    });

    let isHard: boolean;
    if (existing) {
      await this.databaseService.hardWord.delete({
        where: { id: existing.id },
      });
      isHard = false;
    } else {
      await this.databaseService.hardWord.create({
        data: {
          userId,
          rapidFireWordId: wordId,
        },
      });
      isHard = true;
    }

    const jlptLevel = word.rapidFireLesson?.jlptLevel || JlptLevel.N5;
    const totalHardCount = await this.databaseService.hardWord.count({
      where: {
        userId,
        rapidFireWord: { rapidFireLesson: { jlptLevel } },
      },
    });

    await this.databaseService.rapidFireOverallStat.upsert({
      where: {
        userId_jlptLevel: {
          userId,
          jlptLevel,
        },
      },
      create: {
        userId,
        jlptLevel,
        totalHardWords: totalHardCount,
      },
      update: {
        totalHardWords: totalHardCount,
      },
    });

    await this.cache.delete(this.cacheKey(userId, jlptLevel));

    return {
      wordId,
      isHard,
      totalHardWords: totalHardCount,
    };
  }

  async markHardWord(
    userId: string,
    wordId: string,
  ): Promise<ToggleHardWordResponseDto> {
    const word = await this.databaseService.rapidFireWord.findUnique({
      where: { id: wordId },
      include: { rapidFireLesson: true },
    });

    if (!word) {
      throw new NotFoundException(`Word with id '${wordId}' not found`);
    }

    const existing = await this.databaseService.hardWord.findUnique({
      where: {
        userId_rapidFireWordId: {
          userId,
          rapidFireWordId: wordId,
        },
      },
    });

    if (!existing) {
      await this.databaseService.hardWord.create({
        data: {
          userId,
          rapidFireWordId: wordId,
        },
      });
    }

    const jlptLevel = word.rapidFireLesson?.jlptLevel || JlptLevel.N5;
    const totalHardCount = await this.databaseService.hardWord.count({
      where: {
        userId,
        rapidFireWord: { rapidFireLesson: { jlptLevel } },
      },
    });

    await this.databaseService.rapidFireOverallStat.upsert({
      where: {
        userId_jlptLevel: {
          userId,
          jlptLevel,
        },
      },
      create: {
        userId,
        jlptLevel,
        totalHardWords: totalHardCount,
      },
      update: {
        totalHardWords: totalHardCount,
      },
    });

    await this.cache.delete(this.cacheKey(userId, jlptLevel));

    return {
      wordId,
      isHard: true,
      totalHardWords: totalHardCount,
    };
  }

  async unmarkHardWord(
    userId: string,
    wordId: string,
  ): Promise<ToggleHardWordResponseDto> {
    const word = await this.databaseService.rapidFireWord.findUnique({
      where: { id: wordId },
      include: { rapidFireLesson: true },
    });

    if (!word) {
      throw new NotFoundException(`Word with id '${wordId}' not found`);
    }

    const existing = await this.databaseService.hardWord.findUnique({
      where: {
        userId_rapidFireWordId: {
          userId,
          rapidFireWordId: wordId,
        },
      },
    });

    if (existing) {
      await this.databaseService.hardWord.delete({
        where: { id: existing.id },
      });
    }

    const jlptLevel = word.rapidFireLesson?.jlptLevel || JlptLevel.N5;
    const totalHardCount = await this.databaseService.hardWord.count({
      where: {
        userId,
        rapidFireWord: { rapidFireLesson: { jlptLevel } },
      },
    });

    await this.databaseService.rapidFireOverallStat.upsert({
      where: {
        userId_jlptLevel: {
          userId,
          jlptLevel,
        },
      },
      create: {
        userId,
        jlptLevel,
        totalHardWords: totalHardCount,
      },
      update: {
        totalHardWords: totalHardCount,
      },
    });

    await this.cache.delete(this.cacheKey(userId, jlptLevel));

    return {
      wordId,
      isHard: false,
      totalHardWords: totalHardCount,
    };
  }

  async submitAnswers(
    userId: string,
    lessonId: string,
    dto: SubmitRapidFireAnswersDto,
    user?: any,
  ): Promise<SubmitRapidFireAnswersResponseDto> {
    if (!dto.answers || dto.answers.length === 0) {
      throw new BadRequestException("At least one answer is required");
    }

    const submittedIds = dto.answers.map((a) => a.wordId);
    if (new Set(submittedIds).size !== submittedIds.length) {
      throw new BadRequestException("Duplicate wordId in answers");
    }

    const rapidFireLesson =
      await this.databaseService.rapidFireLesson.findUnique({
        where: { id: lessonId },
        include: { words: true },
      });

    if (!rapidFireLesson) {
      throw new NotFoundException(
        `Rapid-fire lesson for id '${lessonId}' not found`,
      );
    }

    // Access control: if lesson is premium and user is not admin, verify plan purchase
    if (rapidFireLesson.isPremium && user?.role !== Role.ADMIN) {
      const userPurchases =
        user?.purchases ||
        (await this.databaseService.userPurchase.findMany({
          where: { userId },
          select: { planType: true },
        }));

      const hasAccess =
        (rapidFireLesson.jlptLevel === JlptLevel.N5 &&
          userPurchases.some(
            (p: any) =>
              p.planType === PlanType.RAPID_FIRE_N5 ||
              p.planType === PlanType.N5_RAPID_FIRE_BUNDLE,
          )) ||
        (rapidFireLesson.jlptLevel === JlptLevel.N4 &&
          userPurchases.some(
            (p: any) =>
              p.planType === PlanType.RAPID_FIRE_N4 ||
              p.planType === PlanType.N4_RAPID_FIRE_BUNDLE,
          ));

      if (!hasAccess) {
        throw new ForbiddenException(
          `Rapid-Fire lesson '${rapidFireLesson.title}' is locked. Please unlock the Rapid Fire ${rapidFireLesson.jlptLevel} plan or bundle to practice.`,
        );
      }
    }

    const validWordIds = new Set(
      rapidFireLesson.words.map((word: any) => word.id),
    );
    const invalidAnswer = dto.answers.find(
      (answer) => !validWordIds.has(answer.wordId),
    );

    if (invalidAnswer) {
      throw new NotFoundException(
        `Rapid-fire word '${invalidAnswer.wordId}' does not belong to lesson '${lessonId}'`,
      );
    }

    const overallStat = await this.getOrCreateOverallStat(
      userId,
      rapidFireLesson.jlptLevel,
    );
    const lessonStat = await this.getOrCreateLessonStat(
      overallStat.id,
      overallStat.userId,
      rapidFireLesson.id,
      rapidFireLesson.lessonNumber,
      rapidFireLesson.words.length,
    );

    const totalAnswers = dto.answers.length;
    const totalCorrect = dto.answers.filter(
      (answer) => answer.isCorrect,
    ).length;
    const submittedHardWordIds = dto.answers
      .filter((a) => a.isHard)
      .map((a) => a.wordId);

    // fetch existing hard-word marks for these submitted words
    const existingHardMarks = await this.databaseService.hardWord.findMany({
      where: {
        userId,
        rapidFireWordId: { in: dto.answers.map((a) => a.wordId) },
      },
    });
    const existingSet = new Set(
      existingHardMarks.map((h) => h.rapidFireWordId),
    );

    const toCreate = dto.answers
      .filter((a) => a.isHard && !existingSet.has(a.wordId))
      .map((a) => ({ userId, rapidFireWordId: a.wordId }));
    const toDelete = existingHardMarks.filter((h) => {
      const dtoEntry = dto.answers.find((a) => a.wordId === h.rapidFireWordId);
      return !dtoEntry || !dtoEntry.isHard;
    });

    const hardWordCount = submittedHardWordIds.length;
    const deltaHard = toCreate.length - toDelete.length;

    const updatedLessonTotalAnswers = lessonStat.totalAnswers + totalAnswers;
    const updatedLessonTotalCorrect = lessonStat.totalCorrect + totalCorrect;
    const updatedLessonMasteryRate =
      updatedLessonTotalAnswers > 0
        ? Math.round(
            (updatedLessonTotalCorrect / updatedLessonTotalAnswers) * 100,
          )
        : 0;

    const existingLessonIds = (overallStat.lessonsPracticed ?? []).map(
      (l: any) => l.id,
    );
    const shouldConnect = !existingLessonIds.includes(rapidFireLesson.id);
    const updatedOverallTotalAnswers = overallStat.totalAnswers + totalAnswers;
    const updatedOverallTotalCorrect = overallStat.totalCorrect + totalCorrect;
    const updatedOverallMasteryRate =
      updatedOverallTotalAnswers > 0
        ? Math.round(
            (updatedOverallTotalCorrect / updatedOverallTotalAnswers) * 100,
          )
        : 0;

    const [updatedLessonStat, updatedOverallStat] =
      await this.databaseService.$transaction([
        this.databaseService.rapidFireLessonStat.update({
          where: {
            overallStatId_rapidFireLessonId: {
              overallStatId: overallStat.id,
              rapidFireLessonId: rapidFireLesson.id,
            },
          },
          data: {
            totalWords: rapidFireLesson.words.length,
            totalAnswers: { increment: totalAnswers },
            totalCorrect: { increment: totalCorrect },
            masteryRate: updatedLessonMasteryRate,
            lastPracticed: new Date(),
          },
        }),
        this.databaseService.rapidFireOverallStat.update({
          where: {
            userId_jlptLevel: {
              userId: overallStat.userId,
              jlptLevel: overallStat.jlptLevel,
            },
          },
          data: {
            ...(shouldConnect
              ? { lessonsPracticed: { connect: { id: rapidFireLesson.id } } }
              : {}),
            ...(deltaHard > 0
              ? { totalHardWords: { increment: deltaHard } }
              : {}),
            ...(deltaHard < 0
              ? { totalHardWords: { decrement: Math.abs(deltaHard) } }
              : {}),
            totalAnswers: { increment: totalAnswers },
            totalCorrect: { increment: totalCorrect },
            masteryRate: updatedOverallMasteryRate,
          },
        }),
        // create new hard-word marks
        ...(toCreate.length
          ? [this.databaseService.hardWord.createMany({ data: toCreate })]
          : []),
        // remove unmarked hard-word entries
        ...(toDelete.length
          ? [
              this.databaseService.hardWord.deleteMany({
                where: { id: { in: toDelete.map((d) => d.id) } },
              }),
            ]
          : []),
      ]);

    await this.cache.delete(this.cacheKey(userId, rapidFireLesson.jlptLevel));

    // fetch updated hard-word marks for this lesson for the user
    const updatedHardMarks = await this.databaseService.hardWord.findMany({
      where: {
        userId,
        rapidFireWord: { rapidFireLessonId: rapidFireLesson.id },
      },
      include: { rapidFireWord: true },
    });
    const updatedHardWords = (updatedHardMarks ?? []).map(
      (h: any) => h.rapidFireWord,
    );

    return {
      updatedLesson: this.mapLessonStatToDto(
        { ...updatedLessonStat, rapidFireLesson },
        updatedHardWords.length,
        updatedHardWords,
      ),
      updatedOverall: this.mapOverallStatToDto(updatedOverallStat),
    };
  }

  private async getOrCreateOverallStat(userId: string, jlptLevel: JlptLevel) {
    return this.databaseService.rapidFireOverallStat.upsert({
      where: { userId_jlptLevel: { userId, jlptLevel } },
      update: {},
      create: {
        userId,
        jlptLevel,
        masteryRate: 0,
        totalHardWords: 0,
        totalLessons: 25,
        totalAnswers: 0,
        totalCorrect: 0,
      },
      include: { lessonsPracticed: true },
    });
  }

  private async getOrCreateLessonStat(
    overallStatId: string,
    userId: string,
    rapidFireLessonId: string,
    lessonNumber: number,
    totalWords: number,
  ) {
    return this.databaseService.rapidFireLessonStat.upsert({
      where: {
        overallStatId_rapidFireLessonId: { overallStatId, rapidFireLessonId },
      },
      update: {},
      create: {
        overallStatId,
        rapidFireLessonId,
        userId,
        lessonNumber,
        totalWords,
        masteryRate: 0,
        totalAnswers: 0,
        totalCorrect: 0,
      },
    });
  }

  private mapOverallStatToDto(overallStat: any): OverallStatsDto {
    return {
      jlptLevel: overallStat.jlptLevel,
      lessonsPracticed: (overallStat.lessonsPracticed ?? []).map((l: any) => ({
        id: l.id,
        title: l.title,
        lessonNumber: l.lessonNumber,
        jlptLevel: l.jlptLevel,
      })),
      masteryRate: overallStat.masteryRate,
      totalHardWords: overallStat.totalHardWords,
      totalLessons: overallStat.totalLessons,
      totalAnswers: overallStat.totalAnswers,
      totalCorrect: overallStat.totalCorrect,
    };
  }

  private mapLessonStatToDto(
    stat: any,
    hardWordCount?: number,
    hardWords?: any[],
  ): RapidFireLessonStatDto {
    return {
      lessonId: stat.rapidFireLesson?.id ?? stat.rapidFireLessonId ?? stat.id,
      lessonNumber: stat.lessonNumber,
      lessonTitle: stat.rapidFireLesson?.title ?? stat.title,
      totalWords: stat.totalWords,
      masteryRate: stat.masteryRate,
      hardWordCount: hardWordCount ?? stat.hardWordCount ?? 0,
      hardWords: (hardWords ?? []).map((w: any) => this.mapWordToDto(w, true)),
      totalAnswers: stat.totalAnswers,
      totalCorrect: stat.totalCorrect,
      lastPracticed: stat.lastPracticed
        ? stat.lastPracticed.toISOString()
        : undefined,
    };
  }

  private mapWordToDto(word: any, isHard?: boolean): RapidFireWordDto {
    return {
      id: word.id,
      word: word.word,
      reading: word.reading,
      romaji: word.romaji,
      meaning: word.meaning,
      rapidFireLessonId: word.rapidFireLessonId,
      isHard: !!isHard,
    };
  }
}
