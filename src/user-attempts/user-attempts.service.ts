import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CreateUserAnswerDto } from './dto/create-user-answer.dto';
import { CreateUserAttemptDto } from './dto/create-user-attempt.dto';
import { UpdateUserAttemptDto } from './dto/update-user-attempt.dto';

@Injectable()
export class UserAttemptsService {
  constructor(private readonly databaseService: DatabaseService) { }

  async createAttempt(dto: CreateUserAttemptDto) {
    return this.databaseService.userAttempt.create({
      data: { ...dto, score: 0, completed: false }
    });
  }

  async updateAttempt(id: string, dto: UpdateUserAttemptDto) {
    return this.databaseService.userAttempt.update({
      where: { id },
      data: dto,
    });
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
    await this.databaseService.userAttempt.update({
      where: { id: userAttemptId },
      data: { score, completed: true }
    });
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
        await this.databaseService.userAttempt.update({
          where: { id: userAttemptId },
          data: { completed: true, score: expiredScore, submittedAt: now },
        });
        throw new NotFoundException('Quiz time limit has expired. Your attempt has been automatically submitted.');
      }
    }

    // Validate and save answers
    const quizQuestions = await this.databaseService.quizQuestion.findMany({
      where: { id: { in: answers.map(a => a.quizQuestionId) } },
      include: { question: true },
    });

    const userAnswersToSave = answers.map(ans => {
      const qq = quizQuestions.find(qq => qq.id === ans.quizQuestionId);
      if (!qq) throw new NotFoundException('Invalid quizQuestionId: ' + ans.quizQuestionId);
      const isCorrect = ans.answer === qq.question.correctAnswer;
      return {
        userAttemptId,
        quizQuestionId: ans.quizQuestionId,
        answer: ans.answer,
        correct: isCorrect,
      };
    });

    await this.databaseService.userAnswer.deleteMany({ where: { userAttemptId } });
    await this.databaseService.userAnswer.createMany({ data: userAnswersToSave });

    const score = userAnswersToSave.filter(a => a.correct).length;
    const submittedAt = new Date();

    await this.databaseService.userAttempt.update({
      where: { id: userAttemptId },
      data: { score, completed: true, submittedAt },
    });

    // Build detailed results with full question data
    const results = userAnswersToSave.map(ans => {
      const qq = quizQuestions.find(q => q.id === ans.quizQuestionId);

      if (!qq) throw new NotFoundException('Question not found for quizQuestionId: ' + ans.quizQuestionId);

      return {
        quizQuestionId: ans.quizQuestionId,
        question: {
          id: qq.question.id,
          content: qq.question.content,
          options: qq.question.options,
          correctAnswer: qq.question.correctAnswer,
          explanation: qq.question.explanation,
          questionType: qq.question.questionType,
        },
        userAnswer: ans.answer,
        correctAnswer: qq.question.correctAnswer,
        isCorrect: ans.correct,
      };
    });

    return {
      score,
      totalQuestions: results.length,
      results,
    };
  }
}
