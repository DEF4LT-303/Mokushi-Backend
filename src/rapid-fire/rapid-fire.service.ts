import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JlptLevel } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { RapidFireLessonOverviewDto } from './dto/lesson-detail.dto';
import { RapidFireLessonStatDto } from './dto/lesson-stat.dto';
import { OverallStatsDto } from './dto/overall-stats.dto';
import { SubmitRapidFireAnswersResponseDto } from './dto/rapid-fire-answer-response.dto';
import { SubmitRapidFireAnswersDto } from './dto/rapid-fire-answer.dto';
import { RapidFireWordDto } from './dto/rapid-fire-word.dto';

@Injectable()
export class RapidFireService {
  constructor(private readonly databaseService: DatabaseService) { }

  private get db() {
    return this.databaseService as any;
  }

  async getOverallStats(userId: string, jlptLevel?: JlptLevel): Promise<OverallStatsDto> {
    const level = jlptLevel ?? JlptLevel.N5;
    const overall = await this.getOrCreateOverallStat(userId, level);
    return this.mapOverallStatToDto(overall);
  }

  async getLessonStats(userId: string, jlptLevel?: JlptLevel): Promise<RapidFireLessonStatDto[]> {
    const level = jlptLevel ?? JlptLevel.N5;
    const overall = await this.getOrCreateOverallStat(userId, level);

    const lessons = await this.db.rapidFireLesson.findMany({
      where: { jlptLevel: level },
      include: { words: true },
      orderBy: { lessonNumber: 'asc' },
    });

    const stats = await this.db.rapidFireLessonStat.findMany({ where: { overallStatId: overall.id } });

    return lessons.map((lesson: any) => {
      const stat = stats.find((s: any) => s.rapidFireLessonId === lesson.id);
      return {
        lessonId: lesson.id,
        lessonNumber: lesson.lessonNumber,
        lessonTitle: lesson.title,
        totalWords: lesson.words.length,
        masteryRate: stat?.masteryRate ?? 0,
        hardWordCount: stat?.hardWordCount ?? 0,
        totalAnswers: stat?.totalAnswers ?? 0,
        totalCorrect: stat?.totalCorrect ?? 0,
        lastPracticed: stat?.lastPracticed ? stat.lastPracticed.toISOString() : undefined,
      } as RapidFireLessonStatDto;
    });
  }

  async getLessonDetail(userId: string, lessonId: string): Promise<RapidFireLessonOverviewDto> {
    const rapidFireLesson = await this.db.rapidFireLesson.findUnique({ where: { id: lessonId }, include: { words: true } });

    if (!rapidFireLesson) {
      throw new NotFoundException(`Rapid-fire lesson for id '${lessonId}' not found`);
    }

    const overallStat = await this.getOrCreateOverallStat(userId, rapidFireLesson.jlptLevel);
    const lessonStat = await this.getOrCreateLessonStat(
      overallStat.id,
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
    const lessonStat = await this.db.rapidFireLessonStat.findUnique({ where: { id: lessonId }, include: { words: true } });

    if (!lessonStat) {
      throw new NotFoundException(`Rapid-fire lesson stat for id '${lessonId}' not found`);
    }

    return lessonStat.words.map((word: any) => this.mapWordToDto(word));
  }

  async submitAnswers(userId: string, lessonId: string, dto: SubmitRapidFireAnswersDto): Promise<SubmitRapidFireAnswersResponseDto> {
    if (!dto.answers || dto.answers.length === 0) {
      throw new BadRequestException('At least one answer is required');
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
          hardWordCount: lessonStat.hardWordCount + hardWordCount,
          totalAnswers: updatedLessonTotalAnswers,
          totalCorrect: updatedLessonTotalCorrect,
          masteryRate: updatedLessonMasteryRate,
          lastPracticed: new Date(),
        },
      }),
      this.db.rapidFireOverallStat.update({
        where: { userId_jlptLevel: { userId: overallStat.userId, jlptLevel: overallStat.jlptLevel } },
        data: {
          ...(shouldConnect ? { lessonsPracticed: { connect: { id: rapidFireLesson.id } } } : {}),
          totalHardWords: overallStat.totalHardWords + hardWordCount,
          totalAnswers: updatedOverallTotalAnswers,
          totalCorrect: updatedOverallTotalCorrect,
          masteryRate: updatedOverallMasteryRate,
        },
      }),
    ]);

    return {
      updatedLesson: this.mapLessonStatToDto({ ...updatedLessonStat, rapidFireLesson }),
      updatedOverall: this.mapOverallStatToDto(updatedOverallStat),
    };
  }

  private async getOrCreateOverallStat(userId: string, jlptLevel: JlptLevel) {
    const overallStat = await this.db.rapidFireOverallStat.findUnique({
      where: {
        userId_jlptLevel: {
          userId,
          jlptLevel,
        },
      },
      include: { lessonsPracticed: true },
    });

    if (overallStat) {
      return overallStat;
    }

    return this.db.rapidFireOverallStat.create({
      data: {
        userId,
        jlptLevel,
        masteryRate: 0,
        totalHardWords: 0,
        totalLessons: 25,
        totalAnswers: 0,
        totalCorrect: 0,
      },
    });
  }

  private async getOrCreateLessonStat(overallStatId: string, rapidFireLessonId: string, lessonNumber: number, totalWords: number) {
    const existing = await this.db.rapidFireLessonStat.findUnique({
      where: { overallStatId_rapidFireLessonId: { overallStatId, rapidFireLessonId } },
    });

    if (existing) return existing;

    // grab overall to obtain userId for denormalized relation
    const overall = await this.db.rapidFireOverallStat.findUnique({ where: { id: overallStatId } });
    const userId = overall?.userId ?? null;

    return this.db.rapidFireLessonStat.create({
      data: {
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
