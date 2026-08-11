import { Injectable, NotFoundException } from '@nestjs/common';
import { QuestionType } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';

@Injectable()
export class QuestionsService {
  constructor(private readonly databaseService: DatabaseService) { }

  create(createQuestionDto: CreateQuestionDto) {
    return this.databaseService.question.create({ data: createQuestionDto });
  }

  async findMany(params: {
    moduleId?: string;
    lessonId?: string;
    questionType?: string;
    skip?: number;
    take?: number;
  }) {
    const { moduleId, lessonId, questionType, skip, take } = params;
    const where = {
      moduleId: moduleId || undefined,
      lessonId: lessonId || undefined,
      questionType: questionType as QuestionType || undefined,
    };

    const [questions, count] = await Promise.all([
      this.databaseService.question.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' }
      }),
      this.databaseService.question.count({ where })
    ]);

    return {
      count,
      data: questions,
    };
  }

  async findOne(id: string) {
    const question = await this.databaseService.question.findUnique({ where: { id } });
    if (!question) {
      throw new NotFoundException(`Question with id '${id}' not found`);
    }
    return question;
  }

  async update(id: string, updateQuestionDto: UpdateQuestionDto) {
    const existing = await this.databaseService.question.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Question with id '${id}' not found`);
    }
    return this.databaseService.question.update({ where: { id }, data: updateQuestionDto });
  }

  async remove(id: string) {
    const existing = await this.databaseService.question.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Question with id '${id}' not found`);
    }
    return this.databaseService.question.delete({ where: { id } });
  }

  async removeByModule(moduleId: string) {
    const module = await this.databaseService.module.findUnique({ where: { id: moduleId } });
    if (!module) {
      throw new NotFoundException(`Module with id '${moduleId}' not found`);
    }

    const totalCount = await this.databaseService.question.count({ where: { moduleId } });
    const result = await this.databaseService.question.deleteMany({ where: { moduleId } });
    return { deletedCount: result.count, totalCount };
  }
}


