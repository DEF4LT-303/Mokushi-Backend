import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JlptLevel } from '@prisma/client';
import { CacheService } from 'src/common/services/cache.service';
import { DatabaseService } from 'src/database/database.service';
import { RapidFireLessonOverviewDto } from './dto/lesson-detail.dto';
import { RapidFireLessonStatDto } from './dto/lesson-stat.dto';
import { OverallStatsDto } from './dto/overall-stats.dto';
import { SubmitRapidFireAnswersResponseDto } from './dto/rapid-fire-answer-response.dto';
import { SubmitRapidFireAnswersDto } from './dto/rapid-fire-answer.dto';
import { RapidFireWordDto } from './dto/rapid-fire-word.dto';

@Injectable()
export class RapidFireService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly cache: CacheService,
  ) { }

  // TODO: remove once `npx prisma generate` picks up the RapidFire* models
  private get db() {
    return this.databaseService as any;
  }

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
      this.db.rapidFireLesson.findMany({
        where: { jlptLevel: level },
        select: {
          id: true,
          title: true,
          lessonNumber: true,
          _count: { select: { words: true } },
        },
        orderBy: { lessonNumber: 'asc' },
      }),
    ]);

    const stats = await this.db.rapidFireLessonStat.findMany({ where: { overallStatId: overall.id } });

    const lessonDtos: RapidFireLessonStatDto[] = lessons.map((lesson: any) => {
      const stat = stats.find((s: any) => s.rapidFireLessonId === lesson.id);
      return {
        lessonId: lesson.id,
        lessonNumber: lesson.lessonNumber,
        lessonTitle: lesson.title,
        totalWords: lesson._count.words,
        masteryRate: stat?.masteryRate ?? 0,
        hardWordCount: stat?.hardWordCount ?? 0,
        totalAnswers: stat?.totalAnswers ?? 0,
        totalCorrect: stat?.totalCorrect ?? 0,
        lastPracticed: stat?.lastPracticed ? stat.lastPracticed.toISOString() : undefined,
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
  async getOverallStats(userId: string, jlptLevel?: JlptLevel): Promise<OverallStatsDto> {
    const level = jlptLevel ?? JlptLevel.N5;
    const overall = await this.getOrCreateOverallStat(userId, level);
    return this.mapOverallStatToDto(overall);
  }

  async getLessonStats(userId: string, jlptLevel?: JlptLevel): Promise<RapidFireLessonStatDto[]> {
    const level = jlptLevel ?? JlptLevel.N5;
    const combined = await this.getCombinedStats(userId, level);
    return combined.lessons;
  }

  async getLessonDetail(userId: string, lessonId: string): Promise<RapidFireLessonOverviewDto> {
    const rapidFireLesson = await this.db.rapidFireLesson.findUnique({ where: { id: lessonId }, include: { words: true } });

    if (!rapidFireLesson) {
      throw new NotFoundException(`Rapid-fire lesson for id '${lessonId}' not found`);
    }

    const overallStat = await this.getOrCreateOverallStat(userId, rapidFireLesson.jlptLevel);
    const lessonStat = await this.getOrCreateLessonStat(
      overallStat.id,
      overallStat.userId,
      rapidFireLesson.id,
      rapidFireLesson.lessonNumber,
      rapidFireLesson.words.length,
    );

    return {
      lessonId: rapidFireLesson.id,
      lessonTitle: rapidFireLesson.title,
      lessonNumber: rapidFireLesson.lessonNumber,
      jlptLevel: rapidFireLesson.jlptLevel,
      words: rapidFireLesson.words.map((word: any) => this.mapWordToDto(word)),
      lessonStat: this.mapLessonStatToDto({ ...lessonStat, rapidFireLesson }),
      overallStat: this.mapOverallStatToDto(overallStat),
    };
  }

  async getRapidFireWordsForLesson(lessonId: string): Promise<RapidFireWordDto[]> {
    const rapidFireLesson = await this.db.rapidFireLesson.findUnique({ where: { id: lessonId }, include: { words: true } });

    if (!rapidFireLesson) {
      throw new NotFoundException(`Rapid-fire lesson for id '${lessonId}' not found`);
    }

    return rapidFireLesson.words.map((word: any) => this.mapWordToDto(word));
  }

  async submitAnswers(userId: string, lessonId: string, dto: SubmitRapidFireAnswersDto): Promise<SubmitRapidFireAnswersResponseDto> {
    if (!dto.answers || dto.answers.length === 0) {
      throw new BadRequestException('At least one answer is required');
    }

    const submittedIds = dto.answers.map(a => a.wordId);
    if (new Set(submittedIds).size !== submittedIds.length) {
      throw new BadRequestException('Duplicate wordId in answers');
    }

    const rapidFireLesson = await this.db.rapidFireLesson.findUnique({ where: { id: lessonId }, include: { words: true } });

    if (!rapidFireLesson) {
      throw new NotFoundException(`Rapid-fire lesson for id '${lessonId}' not found`);
    }

    const validWordIds = new Set(rapidFireLesson.words.map((word: any) => word.id));
    const invalidAnswer = dto.answers.find(answer => !validWordIds.has(answer.wordId));

    if (invalidAnswer) {
      throw new NotFoundException(`Rapid-fire word '${invalidAnswer.wordId}' does not belong to lesson '${lessonId}'`);
    }

    const overallStat = await this.getOrCreateOverallStat(userId, rapidFireLesson.jlptLevel);
    const lessonStat = await this.getOrCreateLessonStat(
      overallStat.id,
      overallStat.userId,
      rapidFireLesson.id,
      rapidFireLesson.lessonNumber,
      rapidFireLesson.words.length,
    );

    const totalAnswers = dto.answers.length;
    const totalCorrect = dto.answers.filter(answer => answer.isCorrect).length;
    const hardWordCount = dto.answers.filter(answer => answer.isHard).length;

    const updatedLessonTotalAnswers = lessonStat.totalAnswers + totalAnswers;
    const updatedLessonTotalCorrect = lessonStat.totalCorrect + totalCorrect;
    const updatedLessonMasteryRate = updatedLessonTotalAnswers > 0
      ? Math.round((updatedLessonTotalCorrect / updatedLessonTotalAnswers) * 100)
      : 0;

    const existingLessonIds = (overallStat.lessonsPracticed ?? []).map((l: any) => l.id);
    const shouldConnect = !existingLessonIds.includes(rapidFireLesson.id);
    const updatedOverallTotalAnswers = overallStat.totalAnswers + totalAnswers;
    const updatedOverallTotalCorrect = overallStat.totalCorrect + totalCorrect;
    const updatedOverallMasteryRate = updatedOverallTotalAnswers > 0
      ? Math.round((updatedOverallTotalCorrect / updatedOverallTotalAnswers) * 100)
      : 0;

    const [updatedLessonStat, updatedOverallStat] = await this.db.$transaction([
      this.db.rapidFireLessonStat.update({
        where: { overallStatId_rapidFireLessonId: { overallStatId: overallStat.id, rapidFireLessonId: rapidFireLesson.id } },
        data: {
          totalWords: rapidFireLesson.words.length,
          hardWordCount: { increment: hardWordCount },
          totalAnswers: { increment: totalAnswers },
          totalCorrect: { increment: totalCorrect },
          masteryRate: updatedLessonMasteryRate,
          lastPracticed: new Date(),
        },
      }),
      this.db.rapidFireOverallStat.update({
        where: { userId_jlptLevel: { userId: overallStat.userId, jlptLevel: overallStat.jlptLevel } },
        data: {
          ...(shouldConnect ? { lessonsPracticed: { connect: { id: rapidFireLesson.id } } } : {}),
          totalHardWords: { increment: hardWordCount },
          totalAnswers: { increment: totalAnswers },
          totalCorrect: { increment: totalCorrect },
          masteryRate: updatedOverallMasteryRate,
        },
      }),
    ]);

    await this.cache.delete(this.cacheKey(userId, rapidFireLesson.jlptLevel));

    return {
      updatedLesson: this.mapLessonStatToDto({ ...updatedLessonStat, rapidFireLesson }),
      updatedOverall: this.mapOverallStatToDto(updatedOverallStat),
    };
  }

  private async getOrCreateOverallStat(userId: string, jlptLevel: JlptLevel) {
    return this.db.rapidFireOverallStat.upsert({
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
    return this.db.rapidFireLessonStat.upsert({
      where: { overallStatId_rapidFireLessonId: { overallStatId, rapidFireLessonId } },
      update: {},
      create: {
        overallStatId,
        rapidFireLessonId,
        userId,
        lessonNumber,
        totalWords,
        masteryRate: 0,
        hardWordCount: 0,
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

  private mapLessonStatToDto(stat: any): RapidFireLessonStatDto {
    return {
      lessonId: stat.rapidFireLesson?.id ?? stat.rapidFireLessonId ?? stat.id,
      lessonNumber: stat.lessonNumber,
      lessonTitle: stat.rapidFireLesson?.title ?? stat.title,
      totalWords: stat.totalWords,
      masteryRate: stat.masteryRate,
      hardWordCount: stat.hardWordCount,
      totalAnswers: stat.totalAnswers,
      totalCorrect: stat.totalCorrect,
      lastPracticed: stat.lastPracticed ? stat.lastPracticed.toISOString() : undefined,
    };
  }

  private mapWordToDto(word: any): RapidFireWordDto {
    return {
      id: word.id,
      word: word.word,
      reading: word.reading,
      romaji: word.romaji,
      meaning: word.meaning,
    };
  }
}