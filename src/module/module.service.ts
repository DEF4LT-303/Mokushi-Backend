import { Injectable, NotFoundException } from '@nestjs/common';
import { CategoryType, JlptLevel, Quiz } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';

@Injectable()
export class ModuleService {
  constructor(private readonly databaseService: DatabaseService) { }

  async create(createModuleDto: CreateModuleDto) {
    return this.databaseService.module.create({ data: createModuleDto });
  }

  async findMany(params: {
    jlptLevel?: string;
    categoryType?: string;
    skip?: number;
    take?: number;
  }) {
    const { jlptLevel, categoryType, skip, take } = params;
    const where = {
      jlptLevel: jlptLevel as JlptLevel || undefined,
      categoryType: categoryType as CategoryType || undefined,
    };

    const [modules, count] = await Promise.all([
      this.databaseService.module.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' }
      }),
      this.databaseService.module.count({ where })
    ]);

    return {
      count,
      data: modules,
    };
  }

  async findOne(id: string) {
    const module = await this.databaseService.module.findUnique({ where: { id } });
    if (!module) {
      throw new NotFoundException(`Module with id '${id}' not found`);
    }
    return module;
  }

  async update(id: string, updateModuleDto: UpdateModuleDto) {
    const existing = await this.databaseService.module.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Module with id '${id}' not found`);
    }
    return this.databaseService.module.update({ where: { id }, data: updateModuleDto });
  }

  async remove(id: string) {
    const existing = await this.databaseService.module.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Module with id '${id}' not found`);
    }
    return this.databaseService.module.delete({ where: { id } });
  }

  async getQuizByModule(id: string, numQuestions = 10) {
    const module = await this.databaseService.module.findUnique({ where: { id } });
    if (!module) {
      throw new NotFoundException(`Module with id '${id}' not found`);
    }

    const moduleQuestions = await this.databaseService.question.findMany({
      where: { moduleId: id },
    });


    // Shuffle and pick numQuestions random questions
    const shuffled = moduleQuestions.sort(() => 0.5 - Math.random());
    const selectedQuestions = shuffled.slice(0, numQuestions);

    const quiz = await this.databaseService.quiz.create({
      data: {
        title: `${module.name} Quiz` +
          (selectedQuestions.length < numQuestions ? ` (${selectedQuestions.length} questions)` : ''),
        jlptLevel: module.jlptLevel,
        moduleId: module.id,
      } as Quiz
    });

    for (let i = 0; i < selectedQuestions.length; i++) {
      await this.databaseService.quizQuestion.create({
        data: {
          quizId: quiz.id,
          questionId: selectedQuestions[i].id,
          order: i + 1,
        }
      });
    }

    const quizWithQuestions = await this.databaseService.quiz.findUnique({
      where: { id: quiz.id },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: { question: true }
        }
      }
    });

    return {
      module: {
        id: module.id,
        slug: module.slug,
        name: module.name,
        description: module.description,
        jlptLevel: module.jlptLevel,
        categoryType: module.categoryType,
      },
      quiz: {
        id: quizWithQuestions!.id,
        title: quizWithQuestions!.title,
        jlptLevel: quizWithQuestions!.jlptLevel,
        questionCount: quizWithQuestions!.questions.length,
        questions: quizWithQuestions!.questions.map((qq) => ({
          id: qq.question.id,
          order: qq.order,
          content: qq.question.content,
          options: qq.question.options,
          correctAnswer: qq.question.correctAnswer,
          questionType: qq.question.questionType,
          explanation: qq.question.explanation,
        })),
      },
    };
  }
}
