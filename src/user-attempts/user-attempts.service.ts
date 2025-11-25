import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CreateUserAttemptDto } from './dto/create-user-attempt.dto';
import { UpdateUserAttemptDto } from './dto/update-user-attempt.dto';
import { CreateUserAnswerDto } from './dto/create-user-answer.dto';

@Injectable()
export class UserAttemptsService {
  constructor(private readonly databaseService: DatabaseService) {}

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
    await this.databaseService.userAttempt.update({
      where: { id: userAttemptId },
      data: { score, completed: true },
    });
    return score;
  }
}
