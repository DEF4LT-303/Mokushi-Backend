import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';

@Injectable()
export class QuestionsService {
  constructor(private readonly databaseService: DatabaseService) { }

  create(createQuestionDto: CreateQuestionDto) {
    return this.databaseService.question.create({ data: createQuestionDto });
  }

  findMany(params: {
    moduleId?: string;
    type?: string;
    lessonType?: string;
    skip?: number;
    take?: number;
  }) {
    const { moduleId, type, lessonType, skip, take } = params;
    return this.databaseService.question.findMany({
      where: {
        moduleId: moduleId || undefined,
        type: type as any || undefined,
        lessonType: lessonType as any || undefined,
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' }
    });
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
}


