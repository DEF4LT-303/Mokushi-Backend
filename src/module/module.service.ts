import { Injectable, NotFoundException } from '@nestjs/common';
import { CategoryType, JlptLevel } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { CreateGrammarRuleDto } from './dto/create-grammar-rule.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateGrammarRuleDto } from './dto/update-grammar-rule.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { UpdateModuleDto } from './dto/update-module.dto';

@Injectable()
export class ModuleService {
  constructor(private readonly databaseService: DatabaseService) { }

  async create(createModuleDto: CreateModuleDto) {
    const { quizConfigs, ...moduleData } = createModuleDto;

    // Create module first
    const module = await this.databaseService.module.create({
      data: moduleData
    });

    // Create quiz configs if provided
    if (quizConfigs && quizConfigs.length > 0) {
      await this.databaseService.quizConfig.createMany({
        data: quizConfigs.map(config => ({
          ...config,
          moduleId: module.id,
        })),
      });
    }

    // Return module with quiz configs
    return this.databaseService.module.findUnique({
      where: { id: module.id },
      include: { quizConfigs: true, lessons: { include: { grammarRules: true } } },
    });
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
        orderBy: { createdAt: 'desc' },
        include: { quizConfigs: true, lessons: { include: { grammarRules: true } } },
      }),
      this.databaseService.module.count({ where })
    ]);

    return {
      count,
      data: modules,
    };
  }

  async findOne(id: string) {
    const module = await this.databaseService.module.findUnique({
      where: { id },
      include: { quizConfigs: true, lessons: { include: { grammarRules: true } } },
    });
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

    const { quizConfigs, ...moduleData } = updateModuleDto;

    // Update module fields
    const updatedModule = await this.databaseService.module.update({
      where: { id },
      data: moduleData
    });

    // Add new quiz configs if provided
    if (quizConfigs && quizConfigs.length > 0) {
      await this.databaseService.quizConfig.createMany({
        data: quizConfigs.map(config => ({
          ...config,
          moduleId: id,
        })),
      });
    }

    // Return module with quiz configs
    return this.databaseService.module.findUnique({
      where: { id },
      include: { quizConfigs: true, lessons: { include: { grammarRules: true } } },
    });
  }

  async remove(id: string) {
    const existing = await this.databaseService.module.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Module with id '${id}' not found`);
    }
    return this.databaseService.module.delete({ where: { id } });
  }

  // * Quiz config management
  async getQuizConfigsByModule(moduleId: string) {
    return this.databaseService.quizConfig.findMany({
      where: { moduleId },
      orderBy: { numQuestions: 'asc' },
    });
  }

  async createQuizConfig(moduleId: string, config: { name: string; numQuestions: number; durationSec: number }) {
    return this.databaseService.quizConfig.create({
      data: {
        ...config,
        moduleId,
      },
    });
  }

  async updateQuizConfig(configId: string, dto: { name: string; numQuestions: number; durationSec: number }) {
    const existing = await this.databaseService.quizConfig.findFirst({
      where: { id: configId },
    });

    if (!existing) {
      throw new NotFoundException(`Quiz config '${configId}' not found`);
    }

    return this.databaseService.quizConfig.update({
      where: { id: configId },
      data: dto,
    });
  }

  async deleteQuizConfig(configId: string) {
    const existing = await this.databaseService.quizConfig.findFirst({
      where: { id: configId },
    });

    if (!existing) {
      throw new NotFoundException(`Quiz config '${configId}' not found`);
    }

    return this.databaseService.quizConfig.delete({
      where: { id: configId },
    });
  }
  // * Quiz config management

  async getQuizByModule(id: string, quizConfigId: string) {
    const [module, quizConfig] = await Promise.all([
      this.databaseService.module.findUnique({ where: { id } }),
      this.databaseService.quizConfig.findUnique({ where: { id: quizConfigId } }),
    ]);

    if (!module) throw new NotFoundException(`Module with id '${id}' not found`);
    if (!quizConfig || quizConfig.moduleId !== id) {
      throw new NotFoundException(`Quiz config with id '${quizConfigId}' not found for this module`);
    }

    const moduleQuestions = await this.databaseService.question.findMany({
      where: { moduleId: id },
      select: { id: true },
    });

    const shuffled = moduleQuestions.sort(() => 0.5 - Math.random());
    const selectedQuestions = shuffled.slice(0, quizConfig.numQuestions);

    const quiz = await this.databaseService.quiz.create({
      data: {
        title: `${module.name} Quiz - ${quizConfig.name}`,
        jlptLevel: module.jlptLevel,
        moduleId: module.id,
        quizConfigId: quizConfig.id,
        questions: {
          createMany: {
            data: selectedQuestions.map((q, i) => ({
              questionId: q.id,
              order: i + 1,
            })),
          },
        },
      },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: { question: true },
        },
        quizConfig: true,
      },
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
        id: quiz.id,
        title: quiz.title,
        jlptLevel: quiz.jlptLevel,
        questionCount: quiz.questions.length,
        durationSec: quizConfig.durationSec,
        quizConfig: {
          id: quizConfig.id,
          name: quizConfig.name,
          numQuestions: quizConfig.numQuestions,
          durationSec: quizConfig.durationSec,
        },
        questions: quiz.questions.map((qq) => ({
          quizQuestionId: qq.id,
          questionId: qq.question.id,
          order: qq.order,
          content: qq.question.content,
          options: qq.question.options,
          questionType: qq.question.questionType,
        })),
      },
    };
  }

  async fetchAllModuleRules() {
    try {
      const rules = await this.databaseService.rule.findMany({
        orderBy: { createdAt: 'asc' },
      });

      if (!rules || rules.length === 0) {
        throw new NotFoundException('No rules found');
      }

      return rules.map(rule => ({
        id: rule.id,
        name: rule.name,
        rules: rule.rules,
      }));
    } catch (error) {
      throw new Error(`Failed to fetch rules: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getLessonsByModule(moduleId: string) {
    const module = await this.databaseService.module.findUnique({ where: { id: moduleId } });

    if (!module) {
      throw new NotFoundException(`Module with id '${moduleId}' not found`);
    }

    return this.databaseService.lesson.findMany({
      where: { moduleId },
      include: { grammarRules: { include: { examples: true } } },
      orderBy: { lessonNumber: 'asc' },
    });
  }

  async createLesson(moduleId: string, dto: CreateLessonDto) {
    const module = await this.databaseService.module.findUnique({ where: { id: moduleId } });

    if (!module) {
      throw new NotFoundException(`Module with id '${moduleId}' not found`);
    }

    return this.databaseService.lesson.create({
      data: {
        ...dto,
        moduleId,
      },
      include: { grammarRules: { include: { examples: true } } },
    });
  }

  async getLessonById(lessonId: string) {
    const lesson = await this.databaseService.lesson.findUnique({
      where: { id: lessonId },
      include: { grammarRules: { include: { examples: true } } },
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson with id '${lessonId}' not found`);
    }

    return lesson;
  }

  async updateLesson(lessonId: string, dto: UpdateLessonDto) {
    const existing = await this.databaseService.lesson.findUnique({ where: { id: lessonId } });

    if (!existing) {
      throw new NotFoundException(`Lesson with id '${lessonId}' not found`);
    }

    return this.databaseService.lesson.update({
      where: { id: lessonId },
      data: dto,
      include: { grammarRules: { include: { examples: true } } },
    });
  }

  async deleteLesson(lessonId: string) {
    const existing = await this.databaseService.lesson.findUnique({ where: { id: lessonId } });

    if (!existing) {
      throw new NotFoundException(`Lesson with id '${lessonId}' not found`);
    }

    return this.databaseService.lesson.delete({ where: { id: lessonId } });
  }

  async getRulesByLesson(lessonId: string) {
    const lesson = await this.databaseService.lesson.findUnique({ where: { id: lessonId } });

    if (!lesson) {
      throw new NotFoundException(`Lesson with id '${lessonId}' not found`);
    }

    return this.databaseService.grammarRule.findMany({
      where: { lessonId },
      include: { examples: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createRule(lessonId: string, dto: CreateGrammarRuleDto) {
    const lesson = await this.databaseService.lesson.findUnique({ where: { id: lessonId } });

    if (!lesson) {
      throw new NotFoundException(`Lesson with id '${lessonId}' not found`);
    }

    const { examples, ...ruleData } = dto;

    return this.databaseService.grammarRule.create({
      data: {
        ...ruleData,
        lessonId,
        ...(examples && examples.length > 0
          ? {
            examples: {
              create: examples,
            },
          }
          : {}),
      },
      include: { examples: true },
    });
  }

  async getRuleById(ruleId: string) {
    const rule = await this.databaseService.grammarRule.findUnique({
      where: { id: ruleId },
      include: { examples: true },
    });

    if (!rule) {
      throw new NotFoundException(`Grammar rule with id '${ruleId}' not found`);
    }

    return rule;
  }

  async updateRule(ruleId: string, dto: UpdateGrammarRuleDto) {
    const existing = await this.databaseService.grammarRule.findUnique({ where: { id: ruleId } });

    if (!existing) {
      throw new NotFoundException(`Grammar rule with id '${ruleId}' not found`);
    }

    const { examples, ...ruleData } = dto;

    return this.databaseService.grammarRule.update({
      where: { id: ruleId },
      data: {
        ...ruleData,
        ...(examples && examples.length > 0
          ? {
            examples: {
              create: examples,
            },
          }
          : {}),
      },
      include: { examples: true },
    });
  }

  async deleteRule(ruleId: string) {
    const existing = await this.databaseService.grammarRule.findUnique({ where: { id: ruleId } });

    if (!existing) {
      throw new NotFoundException(`Grammar rule with id '${ruleId}' not found`);
    }

    return this.databaseService.grammarRule.delete({ where: { id: ruleId } });
  }
}
