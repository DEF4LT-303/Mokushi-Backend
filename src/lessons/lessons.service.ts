import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CreateGrammarRuleDto } from 'src/module/dto/create-grammar-rule.dto';
import { CreateLessonDto } from 'src/module/dto/create-lesson.dto';
import { UpdateGrammarRuleDto } from 'src/module/dto/update-grammar-rule.dto';
import { UpdateLessonDto } from 'src/module/dto/update-lesson.dto';

@Injectable()
export class LessonsService {
  constructor(private readonly databaseService: DatabaseService) { }

  async getAllLessonsWithRules() {
    return this.databaseService.lesson.findMany({
      orderBy: { lessonNumber: 'asc' },
      include: { grammarRules: { include: { examples: true } } },
    });
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
