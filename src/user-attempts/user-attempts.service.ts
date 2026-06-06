import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { LeaderboardService } from 'src/leaderboard/leaderboard.service';
import { CreateUserAnswerDto } from './dto/create-user-answer.dto';
import { CreateUserAttemptDto } from './dto/create-user-attempt.dto';
import { UpdateUserAttemptDto } from './dto/update-user-attempt.dto';

@Injectable()
export class UserAttemptsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly leaderboardService: LeaderboardService,
  ) { }

  private async invalidateLeaderboardCache(userId?: string | null, moduleId?: string | null, jlptLevel?: string) {
    if (moduleId || jlptLevel) {
      await this.leaderboardService.onAttemptCompleted(userId, moduleId, jlptLevel);
    }
  }

  async createAttempt(dto: CreateUserAttemptDto) {
    return this.databaseService.userAttempt.create({
      data: { ...dto, score: 0, completed: false }
    });
  }

  async updateAttempt(id: string, dto: UpdateUserAttemptDto) {
    const updatedAttempt = await this.databaseService.userAttempt.update({
      where: { id },
      data: dto,
      include: {
        quiz: true,
      },
    });

    // Invalidate leaderboard cache if score or completed status changed
    if (dto.score !== undefined || dto.completed !== undefined) {
      await this.invalidateLeaderboardCache(updatedAttempt.userId, updatedAttempt.quiz.moduleId);
    }

    return updatedAttempt;
  }

  createUserAnswers(attemptId: string, answers: CreateUserAnswerDto[]) {
    return this.databaseService.userAnswer.createMany({
      data: answers.map(ans => ({
        userAttemptId: attemptId,
        quizQuestionId: ans.quizQuestionId,
        answer: ans.answer,
        correct: ans.correct,
      })),
    });
  }

  async calculateScore(userAttemptId: string) {
    const answers = await this.databaseService.userAnswer.findMany({ where: { userAttemptId } });
    const score = answers.filter(ans => ans.correct).length;
    const updatedAttempt = await this.databaseService.userAttempt.update({
      where: { id: userAttemptId },
      data: { score, completed: true },
      include: {
        quiz: true,
      },
    });

    // Invalidate leaderboard cache since score/completed are updated
    await this.invalidateLeaderboardCache(updatedAttempt.userId, updatedAttempt.quiz.moduleId, updatedAttempt.quiz.jlptLevel);

    return score;
  }

  async submitQuizAnswers(userAttemptId: string, answers: { quizQuestionId: string, answer: string }[]) {
    // Fetch the attempt with quiz and config to check timing
    const attempt = await this.databaseService.userAttempt.findUnique({
      where: { id: userAttemptId },
      include: {
        quiz: {
          include: {
            quizConfig: true,
          },
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException(`User attempt with id '${userAttemptId}' not found`);
    }

    if (attempt.completed) {
      throw new NotFoundException('This quiz attempt has already been submitted');
    }

    // Check if time limit has expired
    if (attempt.quiz.quizConfig) {
      const deadline = new Date(attempt.startedAt.getTime() + attempt.quiz.quizConfig.durationSec * 1000);
      const now = new Date();

      if (now > deadline) {
        // Time expired - mark as completed with current score (if any) and throw error
        const existingAnswers = await this.databaseService.userAnswer.findMany({
          where: { userAttemptId },
        });
        const expiredScore = existingAnswers.filter(a => a.correct).length;
        const updatedAttempt = await this.databaseService.userAttempt.update({
          where: { id: userAttemptId },
          data: { completed: true, score: expiredScore, submittedAt: now },
          include: {
            quiz: true,
          },
        });

        // Invalidate leaderboard cache and broadcast updates
        await this.invalidateLeaderboardCache(updatedAttempt.userId, updatedAttempt.quiz.moduleId, updatedAttempt.quiz.jlptLevel);

        throw new NotFoundException('Quiz time limit has expired. Your attempt has been automatically submitted.');
      }
    }

    // Fetch ALL quiz questions for this quiz
    const quizId = attempt.quizId;
    const allQuizQuestions = await this.databaseService.quizQuestion.findMany({
      where: { quizId },
      include: { question: true },
    });

    // Create a map for quick lookup of submitted answers
    const answersMap = new Map(answers.map(a => [a.quizQuestionId, a.answer]));

    // Validate all questions and create answer records
    const userAnswersToSave = allQuizQuestions.map(qq => {
      const userAnswer = answersMap.get(qq.id);
      const isCorrect = userAnswer === qq.question.correctAnswer;
      return {
        userAttemptId,
        quizQuestionId: qq.id,
        answer: userAnswer || null,
        correct: isCorrect,
      };
    });

    const score = userAnswersToSave.filter(a => a.correct).length;
    const submittedAt = new Date();

    // Get total questions from quizConfig or actual quiz questions
    const totalQuestions = allQuizQuestions.length;
    const normalizedScore = totalQuestions > 0
      ? parseFloat(((score / totalQuestions) * 100).toFixed(2))
      : 0;

    const updatedAttempt = await this.databaseService.$transaction(async (tx) => {
      await tx.userAnswer.deleteMany({ where: { userAttemptId } });
      await tx.userAnswer.createMany({ data: userAnswersToSave });

      return tx.userAttempt.update({
        where: { id: userAttemptId },
        data: { score, normalizedScore, completed: true, submittedAt },
        include: { quiz: true },
      });
    });

    await this.invalidateLeaderboardCache(updatedAttempt.quiz.moduleId, updatedAttempt.quiz.jlptLevel);

    // const updatedAttempt = await this.databaseService.$transaction(async (tx) => {
    //   await tx.userAnswer.deleteMany({ where: { userAttemptId } });

    //   await tx.userAnswer.createMany({ data: userAnswersToSave });

    //   return tx.userAttempt.update({
    //     where: { id: userAttemptId },
    //     data: { score, completed: true, submittedAt },
    //     include: {
    //       quiz: true, // IMPORTANT: we need moduleId
    //     },
    //   });
    // });

    // // 🔥 CACHE INVALIDATION HERE
    // await this.invalidateLeaderboardCache(updatedAttempt.quiz.moduleId);

    // Build detailed results with full question data for all questions
    const results = allQuizQuestions.map((qq) => {
      const userAnswer = answersMap.get(qq.id);

      return {
        quizQuestionId: qq.id,
        question: {
          id: qq.question.id,
          content: qq.question.content,
          options: qq.question.options,
          correctAnswer: qq.question.correctAnswer,
          explanation: qq.question.explanation,
          questionType: qq.question.questionType,
        },
        userAnswer: userAnswer || null,
        correctAnswer: qq.question.correctAnswer,
        isCorrect: userAnswer === qq.question.correctAnswer,
      };
    });

    return {
      score,
      totalQuestions: results.length,
      results,
    };
  }

  async getQuizHistory(userId: string, limit?: number, offset?: number, categoryType?: string) {
    const whereClause: any = {
      userId,
      completed: true,
    };

    if (categoryType) {
      whereClause.quiz = {
        module: {
          categoryType,
        },
      };
    }

    const queryOptions: any = {
      where: whereClause,
      include: {
        quiz: {
          select: {
            id: true,
            module: {
              select: { categoryType: true },
            },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    };

    if (limit !== undefined) {
      queryOptions.take = limit;
    }
    if (offset !== undefined) {
      queryOptions.skip = offset;
    }

    // Get total count
    const totalCount = await this.databaseService.userAttempt.count({
      where: whereClause,
    });

    const attempts = await this.databaseService.userAttempt.findMany(queryOptions) as any[];

    const quizIds = [...new Set(attempts.map(a => a.quizId))];

    const questionCounts = await this.databaseService.quizQuestion.groupBy({
      by: ['quizId'],
      where: { quizId: { in: quizIds } },
      _count: { _all: true },
    });

    const countMap = new Map(
      questionCounts.map(q => [q.quizId, q._count._all]),
    );

    const data = attempts.map(attempt => {
      const totalQuestions = countMap.get(attempt.quizId) ?? 0;

      const timeTaken = attempt.submittedAt
        ? Math.round(
          (attempt.submittedAt.getTime() - attempt.startedAt.getTime()) / 1000,
        )
        : 0;

      return {
        id: attempt.id,
        category: attempt.quiz.module?.categoryType ?? 'UNKNOWN',
        date:
          attempt.submittedAt?.toISOString() ??
          attempt.startedAt.toISOString(),
        score: attempt.score,
        totalQuestions,
        timeTaken,
        passed: totalQuestions > 0 ? attempt.score / totalQuestions >= 0.6 : false,
      };
    });

    return {
      total: totalCount,
      data,
    };
  }

  async getQuizHistoryDetail(userAttemptId: string) {
    const attempt = await this.databaseService.userAttempt.findUnique({
      where: { id: userAttemptId },
      include: {
        quiz: {
          include: {
            module: true,
            quizConfig: true,
          },
        },
        userAnswers: {
          include: {
            quizQuestion: {
              include: {
                question: true,
              },
            },
          },
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException(`User attempt with id '${userAttemptId}' not found`);
    }

    if (!attempt.completed) {
      throw new NotFoundException('This quiz attempt has not been completed yet');
    }

    const timeTaken = attempt.submittedAt
      ? Math.round((attempt.submittedAt.getTime() - attempt.startedAt.getTime()) / 1000)
      : 0;

    const totalQuestions = await this.databaseService.quizQuestion.count({
      where: { quizId: attempt.quizId },
    });

    // Build results with detailed question info
    const results = attempt.userAnswers.map(ua => ({
      quizQuestionId: ua.quizQuestionId,
      question: {
        id: ua.quizQuestion.question.id,
        content: ua.quizQuestion.question.content,
        options: ua.quizQuestion.question.options,
        correctAnswer: ua.quizQuestion.question.correctAnswer,
        explanation: ua.quizQuestion.question.explanation,
        questionType: ua.quizQuestion.question.questionType,
      },
      userAnswer: ua.answer || null,
      correctAnswer: ua.quizQuestion.question.correctAnswer,
      isCorrect: ua.correct,
    }));

    return {
      success: true,
      submission: {
        quizDate: attempt.submittedAt || attempt.startedAt,
        score: attempt.score,
        totalQuestions,
        timeTaken,
        results,
      },
    };
  }
}
